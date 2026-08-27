"use client";

/**
 * ChatPanel — Phase 2b-2
 *
 * Live release-room chat. Renders the initial message backlog (server-fetched),
 * subscribes to postgres INSERTs on `room_messages` plus INSERT/DELETE on
 * `room_reactions` (message-targeted), and lets signed-in users post and
 * react via the API. Optimistic posts dedupe against the realtime echo by id.
 *
 * Channel topic is `room:${roomId}:chat` — deliberately NOT shared with
 * PresencePile's `room:${roomId}:presence`. supabase-js returns the same
 * channel instance for a duplicate topic and silently ignores a second
 * subscribe(), so topic-sharing components clobber each other's bindings
 * (this was the bug that killed all release-room realtime). One websocket
 * still carries both channels.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import ReportButton from "@/components/moderation/ReportButton";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import LiveBadge from "@/components/rooms/LiveBadge";
import PresencePile from "@/components/rooms/PresencePile";
import MessageReactions from "@/components/chat/MessageReactions";
import {
  useMessageReactions,
  type ReactionCountRow,
  type ViewerReactionRow,
} from "@/components/chat/useMessageReactions";
import type {
  Profile,
  ReleaseRoom,
  RoomMessage,
  RoomReaction,
} from "@/lib/types/database";

type ChatProfile = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url" | "role"
>;

export interface ChatMessageWithProfile extends RoomMessage {
  profile: ChatProfile;
}

interface ChatPanelProps {
  releaseId: string;
  initialMessages: ChatMessageWithProfile[];
  initialRoom: ReleaseRoom;
  accentColor: string;
  /** Aggregated emoji counts for the backlog messages. */
  initialReactionCounts: ReactionCountRow[];
  /** The viewer's own reactions on backlog messages. */
  initialViewerReactions: ViewerReactionRow[];
}

/* ─── Time-ago, ticks each minute via panel-level interval ─── */

function timeAgo(dateString: string, _tick: number): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
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

/* ─── Avatar (24px) ─── */

function MessageAvatar({ profile }: { profile: ChatProfile }) {
  const initial = (
    profile.display_name ||
    profile.username ||
    "?"
  )
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

/* ─── Single message row ─── */

function MessageRow({
  message,
  tick,
  pending,
  reactionCounts,
  myReactions,
  canReact,
  canDelete,
  isOwn,
  onDelete,
  onToggleReaction,
  accentColor,
}: {
  message: ChatMessageWithProfile;
  tick: number;
  pending: boolean;
  reactionCounts: Record<string, number>;
  myReactions: Set<string>;
  canReact: boolean;
  /** Own message, or any message when the viewer is staff. */
  canDelete: boolean;
  isOwn: boolean;
  onDelete: () => void;
  onToggleReaction: (emoji: string) => void;
  accentColor: string;
}) {
  const name =
    message.profile.display_name ||
    message.profile.username ||
    "anonymous";
  return (
    <div className="flex gap-2.5 items-start">
      <MessageAvatar profile={message.profile} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/profile/${message.profile.username}`}
            className="text-xs font-bold text-text-primary hover:text-accent-primary transition-colors font-[family-name:var(--font-heading)] truncate max-w-[10rem]"
          >
            {name}
          </Link>
          <VerifiedBadge role={message.profile.role} />
          <span className="text-[10px] text-text-muted tabular-nums">
            {timeAgo(message.created_at, tick)}
          </span>
          {pending && (
            <span className="text-[10px] text-text-muted italic">sending…</span>
          )}
          {/* Universal action order for chat rows: ✕ (delete) first,
              then 🚩 (report). Both always visible — hover doesn't
              exist on touch. Neither shows on optimistic temp rows. */}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete message"
              title={isOwn ? "Delete your message" : "Mod delete"}
              className="pixel-text text-[10px] uppercase tracking-widest text-text-muted hover:text-accent-rose transition-colors"
            >
              ✕
            </button>
          )}
          {!isOwn && !message.id.startsWith("temp-") && (
            <ReportButton
              targetType="room_message"
              targetId={message.id}
              small
            />
          )}
        </div>
        <p className="text-sm text-text-secondary leading-snug whitespace-pre-wrap break-words mt-0.5">
          {message.content}
        </p>
        <MessageReactions
          counts={reactionCounts}
          mine={myReactions}
          canReact={canReact}
          onToggle={onToggleReaction}
          accentColor={accentColor}
        />
      </div>
    </div>
  );
}

/* ─── Main panel ─── */

export default function ChatPanel({
  releaseId,
  initialMessages,
  initialRoom,
  accentColor,
  initialReactionCounts,
  initialViewerReactions,
}: ChatPanelProps) {
  const { user, profile: myProfile } = useAuth();
  const supabaseRef = useRef(createClient());
  const profileCacheRef = useRef<Map<string, ChatProfile>>(new Map());
  // Staff can mod-delete any message (RLS-backed; the API re-checks).
  const isStaff = myProfile?.role === "owner" || myProfile?.role === "admin";

  // Seed profile cache from initial messages.
  useMemo(() => {
    for (const m of initialMessages) {
      profileCacheRef.current.set(m.user_id, m.profile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Messages are stored oldest-first for rendering. The DB query returns
  // newest-first, so we reverse the initial slice.
  const seed = useMemo(
    () => [...initialMessages].reverse(),
    [initialMessages]
  );
  const [messages, setMessages] = useState<ChatMessageWithProfile[]>(seed);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Authors this viewer has blocked. Filtering happens at render
  // time, so realtime arrivals from blocked users never show either
  // (same pattern as DebateRoom / CommentsSection — App Store 1.2).
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
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

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ─── Message reactions (state + optimistic toggle + echo dedupe) ─── */

  const persistReaction = useCallback(
    async (messageId: string, emoji: string, action: "add" | "remove") => {
      const res = await fetch(`/api/rooms/${releaseId}/reactions`, {
        method: action === "add" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, message_id: messageId }),
      });
      if (!res.ok) throw new Error("reaction failed");
    },
    [releaseId]
  );

  const {
    countsFor,
    mineFor,
    toggle: toggleReaction,
    applyRemoteAdd,
    applyRemoteRemove,
  } = useMessageReactions({
    initialCounts: initialReactionCounts,
    initialMine: initialViewerReactions,
    userId: user?.id ?? null,
    persist: persistReaction,
  });

  // Per-minute re-render so timeAgo refreshes without per-message timers.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-scroll on mount.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    // Only on mount — eslint-disable below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Append helper that respects user scroll position ─── */

  const appendMessage = useCallback((msg: ChatMessageWithProfile) => {
    setMessages((prev) => {
      // Dedupe by id.
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    // After paint, scroll to bottom only if user was already near it.
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (!el) return;
      const distanceFromBottom =
        el.scrollHeight - (el.scrollTop + el.clientHeight);
      if (distanceFromBottom < 100) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, []);

  /* ─── Profile lookup with in-memory cache ─── */

  const fetchProfile = useCallback(
    async (userId: string): Promise<ChatProfile | null> => {
      const cached = profileCacheRef.current.get(userId);
      if (cached) return cached;

      const { data, error } = await supabaseRef.current
        .from("profiles")
        .select("id, username, display_name, avatar_url, role")
        .eq("id", userId)
        .single();

      if (error || !data) return null;
      const profile = data as ChatProfile;
      profileCacheRef.current.set(userId, profile);
      return profile;
    },
    []
  );

  /* ─── Realtime subscription ─── */

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = supabaseRef.current;
    const roomId = initialRoom.id;

    // All bindings MUST be chained before the single .subscribe() call —
    // subscribe() on an already-joining channel is a silent no-op and the
    // join only carries the bindings that exist when it fires.
    const channel = supabase
      .channel(`room:${roomId}:chat`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "room_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { new: RoomReaction }) => {
          const row = payload.new;
          if (!row || row.target_type !== "message" || !row.message_id) return;
          applyRemoteAdd(row.message_id, row.emoji, row.user_id);
        }
      )
      .on(
        "postgres_changes" as never,
        {
          event: "DELETE",
          schema: "public",
          table: "room_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { old: Partial<RoomReaction> }) => {
          // DELETE payloads carry the full old row thanks to REPLICA
          // IDENTITY FULL (migration 008); guard anyway.
          const row = payload.old;
          if (!row || row.target_type !== "message") return;
          if (!row.message_id || !row.emoji || !row.user_id) return;
          applyRemoteRemove(row.message_id, row.emoji, row.user_id);
        }
      )
      .on(
        "postgres_changes" as never,
        {
          // Deliberately UNFILTERED: room_messages has default replica
          // identity, so DELETE payloads only carry the primary key —
          // a room_id filter would never match. Match by id instead.
          event: "DELETE",
          schema: "public",
          table: "room_messages",
        },
        (payload: { old: { id?: string } | null }) => {
          const id = payload.old?.id;
          if (!id) return;
          setMessages((prev) => prev.filter((m) => m.id !== id));
        }
      )
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload: { new: RoomMessage }) => {
          const row = payload.new;
          if (!row || !row.id) return;

          const profile = await fetchProfile(row.user_id);
          if (!profile) return;

          const enriched: ChatMessageWithProfile = { ...row, profile };

          // Drop the optimistic placeholder for this user (if any) whose
          // content matches; the real row replaces it via dedupe-by-id.
          setMessages((prev) => {
            // If id is already present (rare race), do nothing.
            if (prev.some((m) => m.id === enriched.id)) return prev;

            // Remove any temp message from this user with same content.
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

          // Scroll behavior matches appendMessage.
          requestAnimationFrame(() => {
            const el = listRef.current;
            if (!el) return;
            const distanceFromBottom =
              el.scrollHeight - (el.scrollTop + el.clientHeight);
            if (distanceFromBottom < 100) {
              el.scrollTop = el.scrollHeight;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialRoom.id, fetchProfile, applyRemoteAdd, applyRemoteRemove]);

  /* ─── Submit handler ─── */

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = content.trim();
      if (!text || submitting || !user) return;

      setErrorMsg(null);
      setSubmitting(true);

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nowIso = new Date().toISOString();

      // Build optimistic profile from auth user / cache / fallback.
      const cached = profileCacheRef.current.get(user.id);
      const optimisticProfile: ChatProfile = cached ?? {
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

      const optimistic: ChatMessageWithProfile = {
        id: tempId,
        room_id: initialRoom.id,
        user_id: user.id,
        content: text,
        track_position: null,
        created_at: nowIso,
        profile: optimisticProfile,
      };

      appendMessage(optimistic);
      setPendingIds((s) => {
        const n = new Set(s);
        n.add(tempId);
        return n;
      });
      setContent("");
      // Reset textarea height after clearing.
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      try {
        const res = await fetch(`/api/rooms/${releaseId}/messages`, {
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
        const data = (await res.json()) as { message: ChatMessageWithProfile };
        // Cache the real profile for future realtime payloads.
        profileCacheRef.current.set(data.message.user_id, data.message.profile);
        // Replace temp with real (Realtime will also try; dedupe by id wins).
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) {
            // Real already arrived via Realtime; just drop the temp.
            return prev.filter((m) => m.id !== tempId);
          }
          return prev.map((m) => (m.id === tempId ? data.message : m));
        });
      } catch (err) {
        // Revert optimistic on failure.
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to send message"
        );
      } finally {
        setPendingIds((s) => {
          const n = new Set(s);
          n.delete(tempId);
          return n;
        });
        setSubmitting(false);
      }
    },
    [content, submitting, user, releaseId, initialRoom.id, appendMessage]
  );

  /* ─── Delete a message: your own, or any as staff. Confirm guards
     the moderation case; the realtime DELETE listener above echoes
     the removal to everyone else in the room. ─── */
  const handleDeleteMessage = useCallback(
    async (m: ChatMessageWithProfile) => {
      const isOwn = m.user_id === (user?.id ?? "");
      if (!isOwn) {
        const name = m.profile.display_name || m.profile.username;
        if (!window.confirm(`Delete ${name}'s message?`)) return;
      }
      const res = await fetch(
        `/api/rooms/${releaseId}/messages/${m.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setMessages((prev) => prev.filter((x) => x.id !== m.id));
      }
    },
    [user?.id, releaseId]
  );

  /* ─── Auto-grow textarea (max ~4 rows) ─── */

  const handleTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setContent(e.target.value);
    const el = e.currentTarget;
    el.style.height = "auto";
    const max = 4 * 22; // ~22px per row
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e as unknown as React.FormEvent);
    }
  };

  /* ─── Render ─── */

  // Hide messages from blocked authors (initial load AND realtime).
  const visibleMessages = messages.filter((m) => !blockedIds.has(m.user_id));
  const isEmpty = visibleMessages.length === 0;

  return (
    // xl: fills its grid column (the release page gives it the whole
    // right side, sticky + viewport-height) — flex column so the
    // message list absorbs the extra height and scrolls internally.
    <div
      className="panel-xbox p-4 sm:p-5 space-y-4 relative overflow-hidden xl:h-full xl:flex xl:flex-col"
      style={{ borderColor: `${accentColor}30` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="glow-orb" />
        <span className="label-xbox">Live Room</span>
        <span className="text-xs text-text-muted ml-1">
          ({visibleMessages.filter((m) => !m.id.startsWith("temp-")).length})
        </span>
        <LiveBadge lastActivityAt={initialRoom.last_activity_at} />
        <div className="ml-auto">
          <PresencePile roomId={initialRoom.id} accentColor={accentColor} />
        </div>
      </div>

      <div className="divider-glow" />

      {/* Messages list */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Live room messages"
        // Phone: capped height, page scrolls past the room. Desktop
        // (xl, the full-height column): the cap lifts and the list
        // flexes to fill whatever the viewport gives it.
        className="overflow-y-auto pr-1 space-y-3 max-h-[min(60vh,500px)] min-h-[240px] xl:max-h-none xl:flex-1 xl:min-h-0"
      >
        {isEmpty ? (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center gap-3 py-8">
            <span
              className="glow-orb"
              style={{
                background: accentColor,
                boxShadow: `0 0 12px ${accentColor}, 0 0 24px ${accentColor}80`,
              }}
            />
            <p className="text-sm text-text-muted max-w-xs">
              No one&apos;s in the room yet — be first to drop a take.
            </p>
          </div>
        ) : (
          visibleMessages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              tick={tick}
              pending={pendingIds.has(m.id)}
              reactionCounts={countsFor(m.id)}
              myReactions={mineFor(m.id)}
              canReact={!!user && !m.id.startsWith("temp-")}
              canDelete={
                (m.user_id === (user?.id ?? "") || isStaff) &&
                !m.id.startsWith("temp-")
              }
              isOwn={m.user_id === (user?.id ?? "")}
              onDelete={() => void handleDeleteMessage(m)}
              onToggleReaction={(emoji) => void toggleReaction(m.id, emoji)}
              accentColor={accentColor}
            />
          ))
        )}
      </div>

      <div className="divider-glow" />

      {/* Composer / sign-in prompt */}
      {user ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Drop a take…"
            rows={1}
            maxLength={1000}
            aria-label="Message input"
            className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-subtle text-text-primary placeholder:text-text-muted text-sm focus:outline-none transition-all resize-none"
            style={
              {
                ["--tw-ring-color" as string]: `${accentColor}40`,
              } as React.CSSProperties
            }
            onFocus={(e) => {
              e.currentTarget.style.borderColor = `${accentColor}80`;
              e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}40`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "";
              e.currentTarget.style.boxShadow = "";
            }}
          />
          {errorMsg && (
            <p className="text-xs text-accent-rose">{errorMsg}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-text-muted tabular-nums">
              {content.length}/1000
            </span>
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase transition-all font-[family-name:var(--font-heading)] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: `${accentColor}1f`,
                color: accentColor,
                border: `1px solid ${accentColor}55`,
              }}
            >
              {submitting ? "…" : "Send"}
            </button>
          </div>
        </form>
      ) : (
        <div className="card-y2k p-4 text-center">
          <Link
            href="/login"
            className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase inline-block transition-all font-[family-name:var(--font-heading)]"
            style={{
              background: `${accentColor}1f`,
              color: accentColor,
              border: `1px solid ${accentColor}55`,
            }}
          >
            Sign in to chat
          </Link>
        </div>
      )}

      {/* Scan bar */}
      <div className="scan-bar" />
    </div>
  );
}
