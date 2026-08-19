"use client";

/**
 * DebateRoom — the live client half of a debate page.
 *
 * Three zones:
 *  1. The vote: two big tappable side buttons + the animated split
 *     bar. Voting is optimistic (bar moves instantly) and reconciles
 *     with the counts the API returns. Tapping the other side
 *     switches your vote — debate_votes' composite PK guarantees
 *     one vote per user server-side.
 *  2. The live chat: realtime postgres INSERT subscription on
 *     debate_messages (same pattern as the release-room ChatPanel),
 *     optimistic sends deduped by id against the realtime echo.
 *     Each message carries an emoji reaction strip (optimistic
 *     toggles via useMessageReactions, live via realtime
 *     INSERT/DELETE on debate_message_reactions). Other users'
 *     votes also move the bar live: INSERT/UPDATE on debate_votes
 *     schedules a debounced authoritative refetch of the counts.
 *  3. Side badges: each message is stamped server-side with the
 *     side its author had voted at post time — A gets the accent
 *     color, B gets rose, no vote renders a muted SPECTATOR tag.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import ReportButton from "@/components/moderation/ReportButton";
import VoteBar from "@/components/debates/VoteBar";
import MessageReactions from "@/components/chat/MessageReactions";
import { hapticTap } from "@/lib/native";
import {
  useMessageReactions,
  type ReactionCountRow,
  type ViewerReactionRow,
} from "@/components/chat/useMessageReactions";
import type {
  DebateMessageWithProfile,
  DebateProfile,
  DebateWithMeta,
  VoteCounts,
} from "@/lib/db/debates";
import type {
  DebateMessage,
  DebateMessageReaction,
} from "@/lib/types/database";

interface DebateRoomProps {
  debate: DebateWithMeta;
  initialMessages: DebateMessageWithProfile[]; // oldest → newest
  initialUserVote: "a" | "b" | null;
  initialReactionCounts: ReactionCountRow[];
  initialViewerReactions: ViewerReactionRow[];
}

/* ─── Small helpers ─── */

function timeAgo(dateString: string, _tick: number): string {
  void _tick; // referenced so per-minute re-renders refresh the label
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  );
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function Avatar({ profile }: { profile: DebateProfile }) {
  const initial = (profile.display_name || profile.username || "?")
    .charAt(0)
    .toUpperCase();
  if (profile.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt={profile.display_name ?? profile.username}
        className="w-6 h-6 rounded-full object-cover border border-white/10 shrink-0"
      />
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-accent-primary uppercase">
        {initial}
      </span>
    </div>
  );
}

/** The side stamp on a message. */
function SideTag({
  side,
  labels,
}: {
  side: "a" | "b" | null;
  labels: { a: string; b: string };
}) {
  if (side === "a") {
    return (
      <span className="pixel-text text-[10px] uppercase px-1 py-px rounded border border-accent-primary/50 text-accent-primary shrink-0">
        {labels.a}
      </span>
    );
  }
  if (side === "b") {
    return (
      <span className="pixel-text text-[10px] uppercase px-1 py-px rounded border border-accent-rose/50 text-accent-rose shrink-0">
        {labels.b}
      </span>
    );
  }
  return (
    <span className="pixel-text text-[10px] uppercase px-1 py-px rounded border border-border-medium text-text-muted shrink-0">
      Spectator
    </span>
  );
}

/* ─── Main component ─── */

export default function DebateRoom({
  debate,
  initialMessages,
  initialUserVote,
  initialReactionCounts,
  initialViewerReactions,
}: DebateRoomProps) {
  const { user } = useAuth();
  const supabaseRef = useRef(createClient());
  const profileCacheRef = useRef<Map<string, DebateProfile>>(new Map());
  const isClosed = debate.status === "closed";

  // Seed the profile cache so realtime rows from known posters don't
  // need a lookup round-trip.
  useMemo(() => {
    for (const m of initialMessages) {
      profileCacheRef.current.set(m.user_id, m.profile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [votes, setVotes] = useState<VoteCounts>(debate.votes);
  const [myVote, setMyVote] = useState<"a" | "b" | null>(initialUserVote);
  const [voting, setVoting] = useState(false);

  const [messages, setMessages] =
    useState<DebateMessageWithProfile[]>(initialMessages);
  // Authors this viewer has blocked. Filtering happens at render
  // time, so realtime arrivals from blocked users never show either.
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);

  // Per-minute re-render so timeAgo labels stay fresh.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Load the viewer's block list; errors just mean nothing is hidden.
  useEffect(() => {
    if (!user) {
      setBlockedIds(new Set());
      return;
    }
    let cancelled = false;
    fetch("/api/blocks")
      .then((res) => (res.ok ? res.json() : { blocked: [] }))
      .then((data: { blocked?: string[] }) => {
        if (!cancelled) setBlockedIds(new Set(data.blocked ?? []));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Start scrolled to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const scrollIfNearBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (!el) return;
      const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
      if (distance < 100) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const fetchProfile = useCallback(
    async (userId: string): Promise<DebateProfile | null> => {
      const cached = profileCacheRef.current.get(userId);
      if (cached) return cached;
      const { data, error } = await supabaseRef.current
        .from("profiles")
        .select("id, username, display_name, avatar_url, role")
        .eq("id", userId)
        .single();
      if (error || !data) return null;
      const profile = data as DebateProfile;
      profileCacheRef.current.set(userId, profile);
      return profile;
    },
    []
  );

  /* ─── Message reactions ─── */

  // Persist a reaction toggle; useMessageReactions rolls back if we throw.
  const persistReaction = useCallback(
    async (messageId: string, emoji: string, action: "add" | "remove") => {
      const res = await fetch(`/api/debates/${debate.id}/reactions`, {
        method: action === "add" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, message_id: messageId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Reaction failed");
      }
    },
    [debate.id]
  );

  const { countsFor, mineFor, toggle, applyRemoteAdd, applyRemoteRemove } =
    useMessageReactions({
      initialCounts: initialReactionCounts,
      initialMine: initialViewerReactions,
      userId: user?.id ?? null,
      persist: persistReaction,
    });

  // Debounce timer for the live vote-count refetch (cleared on unmount).
  const voteRefetchTimerRef = useRef<number | null>(null);

  /* ─── Realtime: messages, reactions, and votes in this debate ─── */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = supabaseRef.current;

    // A burst of vote changes collapses into ONE authoritative refetch.
    // The viewer's own vote already reconciles from the POST response;
    // the echo-triggered refetch just re-reads the same truth.
    const scheduleVoteRefetch = () => {
      if (voteRefetchTimerRef.current !== null) {
        window.clearTimeout(voteRefetchTimerRef.current);
      }
      voteRefetchTimerRef.current = window.setTimeout(async () => {
        voteRefetchTimerRef.current = null;
        const { data, error } = await supabase
          .from("debate_votes")
          .select("side")
          .eq("debate_id", debate.id);
        if (error || !data) return;
        const next: VoteCounts = { a: 0, b: 0 };
        for (const row of data as { side: "a" | "b" }[]) {
          next[row.side] += 1;
        }
        setVotes(next);
      }, 300);
    };

    // Every binding chains onto the SAME builder before the single
    // .subscribe() — subscribing an already-joining channel is a
    // silent no-op in supabase-js.
    const channel = supabase
      .channel(`debate:${debate.id}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "debate_messages",
          filter: `debate_id=eq.${debate.id}`,
        },
        async (payload: { new: DebateMessage }) => {
          const row = payload.new;
          if (!row || !row.id) return;
          const profile = await fetchProfile(row.user_id);
          if (!profile) return;
          const enriched: DebateMessageWithProfile = { ...row, profile };

          setMessages((prev) => {
            if (prev.some((m) => m.id === enriched.id)) return prev;
            // Replace this user's optimistic placeholder with same text.
            const filtered = prev.filter(
              (m) =>
                !(
                  m.id.startsWith("temp-") &&
                  m.user_id === enriched.user_id &&
                  m.content === enriched.content
                )
            );
            return [...filtered, enriched];
          });
          scrollIfNearBottom();
        }
      )
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "debate_message_reactions",
          filter: `debate_id=eq.${debate.id}`,
        },
        (payload: { new: DebateMessageReaction }) => {
          const row = payload.new;
          if (!row?.message_id || !row.emoji || !row.user_id) return;
          applyRemoteAdd(row.message_id, row.emoji, row.user_id);
        }
      )
      .on(
        "postgres_changes" as never,
        {
          event: "DELETE",
          schema: "public",
          table: "debate_message_reactions",
          filter: `debate_id=eq.${debate.id}`,
        },
        (payload: { old: Partial<DebateMessageReaction> }) => {
          // REPLICA IDENTITY FULL means `old` carries every column,
          // but guard anyway — a partial payload is dropped, not crashed.
          const row = payload.old;
          if (!row?.message_id || !row.emoji || !row.user_id) return;
          applyRemoteRemove(row.message_id, row.emoji, row.user_id);
        }
      )
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "debate_votes",
          filter: `debate_id=eq.${debate.id}`,
        },
        scheduleVoteRefetch
      )
      .on(
        "postgres_changes" as never,
        {
          event: "UPDATE",
          schema: "public",
          table: "debate_votes",
          filter: `debate_id=eq.${debate.id}`,
        },
        scheduleVoteRefetch
      )
      .subscribe();

    return () => {
      if (voteRefetchTimerRef.current !== null) {
        window.clearTimeout(voteRefetchTimerRef.current);
        voteRefetchTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [
    debate.id,
    fetchProfile,
    scrollIfNearBottom,
    applyRemoteAdd,
    applyRemoteRemove,
  ]);

  /* ─── Voting ─── */
  const castVote = useCallback(
    async (side: "a" | "b") => {
      if (!user || voting || isClosed || myVote === side) return;
      hapticTap(); // physical thunk on vote in the app; no-op on web
      setVoting(true);
      setErrorMsg(null);

      // Optimistic: move my vote between the buckets immediately.
      const prevVote = myVote;
      const prevCounts = votes;
      setMyVote(side);
      setVotes((v) => ({
        a: v.a + (side === "a" ? 1 : 0) - (prevVote === "a" ? 1 : 0),
        b: v.b + (side === "b" ? 1 : 0) - (prevVote === "b" ? 1 : 0),
      }));

      try {
        const res = await fetch(`/api/debates/${debate.id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ side }),
        });
        const data = (await res.json()) as {
          votes?: VoteCounts;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Vote failed");
        // Reconcile with the authoritative counts.
        if (data.votes) setVotes(data.votes);
      } catch (err) {
        // Roll back the optimistic move.
        setMyVote(prevVote);
        setVotes(prevCounts);
        setErrorMsg(err instanceof Error ? err.message : "Vote failed");
      } finally {
        setVoting(false);
      }
    },
    [user, voting, isClosed, myVote, votes, debate.id]
  );

  /* ─── Sending a take ─── */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = content.trim();
      if (!text || submitting || !user || isClosed) return;

      setErrorMsg(null);
      setSubmitting(true);

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const cached = profileCacheRef.current.get(user.id);
      const optimisticProfile: DebateProfile = cached ?? {
        id: user.id,
        username:
          (user.user_metadata?.username as string | undefined) ??
          user.email?.split("@")[0] ??
          "you",
        display_name:
          (user.user_metadata?.display_name as string | undefined) ?? null,
        avatar_url:
          (user.user_metadata?.avatar_url as string | undefined) ?? null,
        role: "user",
      };

      const optimistic: DebateMessageWithProfile = {
        id: tempId,
        debate_id: debate.id,
        user_id: user.id,
        side: myVote, // best guess; server stamps the real one
        content: text,
        created_at: new Date().toISOString(),
        profile: optimisticProfile,
      };

      setMessages((prev) => [...prev, optimistic]);
      setPendingIds((s) => new Set(s).add(tempId));
      setContent("");
      scrollIfNearBottom();

      try {
        const res = await fetch(`/api/debates/${debate.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Failed to send");
        }
        const data = (await res.json()) as {
          message: DebateMessageWithProfile;
        };
        profileCacheRef.current.set(
          data.message.user_id,
          data.message.profile
        );
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) {
            return prev.filter((m) => m.id !== tempId);
          }
          return prev.map((m) => (m.id === tempId ? data.message : m));
        });
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setErrorMsg(err instanceof Error ? err.message : "Failed to send");
      } finally {
        setPendingIds((s) => {
          const n = new Set(s);
          n.delete(tempId);
          return n;
        });
        setSubmitting(false);
      }
    },
    [content, submitting, user, isClosed, debate.id, myVote, scrollIfNearBottom]
  );

  const sideLabels = { a: debate.side_a_label, b: debate.side_b_label };
  // Hide messages from blocked authors (initial load AND realtime).
  const visibleMessages = messages.filter((m) => !blockedIds.has(m.user_id));
  const realCount = visibleMessages.filter((m) => !m.id.startsWith("temp-")).length;

  return (
    <div className="space-y-6">
      {/* ══════════ THE VOTE ══════════ */}
      <section className="panel-xbox-glow p-4 sm:p-6 space-y-4 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">Cast your vote</span>
          {isClosed && (
            <span className="pixel-text text-xs text-text-muted uppercase">
              — debate closed
            </span>
          )}
        </div>

        {/* Two big tappable sides */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => castVote("a")}
            disabled={!user || isClosed || voting}
            className={`rounded-lg border-2 px-3 py-4 sm:py-5 text-center transition-all font-[family-name:var(--font-heading)] font-bold uppercase tracking-wide text-sm sm:text-base disabled:cursor-not-allowed
              ${
                myVote === "a"
                  ? "border-accent-primary bg-accent-primary/15 text-accent-primary shadow-[0_0_20px_rgba(30,144,255,0.3)]"
                  : "border-border-medium text-text-secondary hover:border-accent-primary/60 hover:text-accent-primary"
              }`}
          >
            {debate.side_a_label}
            {myVote === "a" && (
              <span className="block pixel-text text-[10px] mt-1 opacity-80">
                YOUR SIDE
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => castVote("b")}
            disabled={!user || isClosed || voting}
            className={`rounded-lg border-2 px-3 py-4 sm:py-5 text-center transition-all font-[family-name:var(--font-heading)] font-bold uppercase tracking-wide text-sm sm:text-base disabled:cursor-not-allowed
              ${
                myVote === "b"
                  ? "border-accent-rose bg-accent-rose/15 text-accent-rose shadow-[0_0_20px_rgba(224,85,117,0.3)]"
                  : "border-border-medium text-text-secondary hover:border-accent-rose/60 hover:text-accent-rose"
              }`}
          >
            {debate.side_b_label}
            {myVote === "b" && (
              <span className="block pixel-text text-[10px] mt-1 opacity-80">
                YOUR SIDE
              </span>
            )}
          </button>
        </div>

        <VoteBar
          a={votes.a}
          b={votes.b}
          sideALabel={debate.side_a_label}
          sideBLabel={debate.side_b_label}
        />

        <p className="text-[10px] text-text-muted text-center tabular-nums">
          {votes.a + votes.b} votes · switch sides any time
        </p>

        {!user && (
          <p className="text-xs text-text-muted text-center">
            <Link href="/login" className="text-accent-primary hover:underline">
              Sign in
            </Link>{" "}
            to vote and argue.
          </p>
        )}
        <div className="scan-bar" />
      </section>

      {/* ══════════ THE FLOOR (live chat) ══════════ */}
      <section className="panel-xbox p-4 sm:p-5 space-y-4 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="glow-orb" style={{ animationDelay: "1s" }} />
          <span className="label-xbox">The floor</span>
          <span className="text-xs text-text-muted">({realCount})</span>
        </div>

        <div className="divider-glow" />

        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-label="Debate messages"
          className="overflow-y-auto pr-1 space-y-3"
          style={{ maxHeight: "min(60vh, 500px)", minHeight: "240px" }}
        >
          {visibleMessages.length === 0 ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center gap-3 py-8">
              <span className="osd-text text-sm">DEAD AIR</span>
              <p className="text-sm text-text-muted max-w-xs">
                Nobody has argued yet — first take wins.
              </p>
            </div>
          ) : (
            visibleMessages.map((m) => (
              <div key={m.id} className="flex gap-2.5 items-start group">
                <Avatar profile={m.profile} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/profile/${m.profile.username}`}
                      className="text-xs font-bold text-text-primary hover:text-accent-primary transition-colors font-[family-name:var(--font-heading)] truncate max-w-[10rem]"
                    >
                      {m.profile.display_name || m.profile.username}
                    </Link>
                    <VerifiedBadge role={m.profile.role} />
                    <SideTag side={m.side} labels={sideLabels} />
                    <span className="text-[10px] text-text-muted tabular-nums">
                      {timeAgo(m.created_at, tick)}
                    </span>
                    {pendingIds.has(m.id) && (
                      <span className="text-[10px] text-text-muted italic">
                        sending…
                      </span>
                    )}
                    {/* Report flag — appears on hover, never on your own
                        takes, never on optimistic temp rows (no real id
                        to report yet). */}
                    {m.user_id !== (user?.id ?? "") &&
                      !m.id.startsWith("temp-") && (
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ReportButton
                            targetType="debate_message"
                            targetId={m.id}
                            small
                          />
                        </span>
                      )}
                  </div>
                  <p className="text-sm text-text-secondary leading-snug whitespace-pre-wrap break-words mt-0.5">
                    {m.content}
                  </p>
                  {/* Reaction strip — disabled while signed out, on
                      archived debates, and on optimistic temp rows
                      (no real id to react to yet). */}
                  <MessageReactions
                    counts={countsFor(m.id)}
                    mine={mineFor(m.id)}
                    canReact={!!user && !isClosed && !m.id.startsWith("temp-")}
                    onToggle={(emoji) => void toggle(m.id, emoji)}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="divider-glow" />

        {/* Composer */}
        {isClosed ? (
          <p className="text-center text-xs text-text-muted py-2 pixel-text uppercase">
            Sign-off — this debate is archived.
          </p>
        ) : user ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder={
                myVote
                  ? `Argue for ${myVote === "a" ? debate.side_a_label : debate.side_b_label}…`
                  : "Drop a take (vote to rep a side)…"
              }
              rows={1}
              maxLength={500}
              aria-label="Debate message input"
              className="form-input resize-none"
            />
            {errorMsg && <p className="text-xs text-accent-rose">{errorMsg}</p>}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-text-muted tabular-nums">
                {content.length}/500
              </span>
              <button
                type="submit"
                disabled={!content.trim() || submitting}
                className="btn-y2k btn-y2k-primary !py-1.5 !px-4 !text-xs disabled:opacity-40"
              >
                {submitting ? "…" : "Send"}
              </button>
            </div>
          </form>
        ) : (
          <div className="card-y2k p-4 text-center">
            <Link href="/login" className="btn-y2k btn-y2k-outline !py-1.5 !px-4 !text-xs">
              Sign in to argue
            </Link>
          </div>
        )}

        <div className="scan-bar" />
      </section>
    </div>
  );
}
