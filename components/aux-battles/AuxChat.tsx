"use client";

/**
 * AuxChat — the live chat of an aux battle room. Its own realtime
 * channel (INSERT/DELETE on aux_messages for this room), optimistic
 * sends deduped against the echo, blocked authors hidden, ✕ delete
 * for your own rows (host and staff can pull anyone's), 🚩 report on
 * everyone else's. Same bones as the debate floor it replaces.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import UserLink from "@/components/ui/UserLink";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useLocale, useTranslations } from "next-intl";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import ReportButton from "@/components/moderation/ReportButton";
import type { AuxMessage } from "@/lib/types/database";
import type { AuxMessageWithProfile, AuxProfile } from "@/lib/db/aux-battles";
import { AuxAvatar } from "@/components/aux-battles/PlayerChip";

interface Props {
  roomId: string;
  hostId: string;
  initialMessages: AuxMessageWithProfile[];
  /** Finished rooms keep the log readable but close the composer. */
  closed: boolean;
  className?: string;
  /** "panel" (default) = the bordered in-page card, which on xl fills
      its whole grid column. "sheet" = the phone slide-up sheet
      (AuxChatDock) brings its own chrome, so no panel border and the
      message list flexes to the sheet's height. */
  variant?: "panel" | "sheet";
  /** Sheet only: the chevron that tucks it back down. */
  onCollapse?: () => void;
}

function timeAgo(dateString: string, _tick: number, justNow: string, locale: string): string {
  void _tick;
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffSec < 60) return justNow;
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(dateString).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export default function AuxChat({
  roomId,
  hostId,
  initialMessages,
  closed,
  className = "",
  variant = "panel",
  onCollapse,
}: Props) {
  const isSheet = variant === "sheet";
  const { user, profile: myProfile } = useAuth();
  const t = useTranslations("aux.chat");
  const locale = useLocale();
  const supabaseRef = useRef(createClient());
  const profileCacheRef = useRef<Map<string, AuxProfile>>(new Map());
  const listRef = useRef<HTMLDivElement>(null);
  const isStaff = myProfile?.role === "owner" || myProfile?.role === "admin";
  const isHost = user?.id === hostId;

  const [messages, setMessages] = useState<AuxMessageWithProfile[]>(initialMessages);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    for (const m of initialMessages) profileCacheRef.current.set(m.user_id, m.profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

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

  const fetchProfile = useCallback(async (userId: string): Promise<AuxProfile | null> => {
    const cached = profileCacheRef.current.get(userId);
    if (cached) return cached;
    const { data, error } = await supabaseRef.current
      .from("profiles")
      .select("id, username, display_name, avatar_url, role")
      .eq("id", userId)
      .single();
    if (error || !data) return null;
    const profile = data as AuxProfile;
    profileCacheRef.current.set(userId, profile);
    return profile;
  }, []);

  /* Realtime */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`aux-chat:${roomId}`)
      .on(
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "aux_messages", filter: `room_id=eq.${roomId}` },
        async (payload: { new: AuxMessage }) => {
          const row = payload.new;
          if (!row?.id) return;
          const profile = await fetchProfile(row.user_id);
          if (!profile) return;
          const enriched: AuxMessageWithProfile = { ...row, profile };
          setMessages((prev) => {
            if (prev.some((m) => m.id === enriched.id)) return prev;
            const filtered = prev.filter(
              (m) => !(m.id.startsWith("temp-") && m.user_id === enriched.user_id && m.content === enriched.content)
            );
            return [...filtered, enriched];
          });
          scrollIfNearBottom();
        }
      )
      .on(
        "postgres_changes" as never,
        // REPLICA IDENTITY FULL on aux_messages, so the room filter works on deletes too.
        { event: "DELETE", schema: "public", table: "aux_messages", filter: `room_id=eq.${roomId}` },
        (payload: { old: { id?: string } | null }) => {
          const id = payload.old?.id;
          if (!id) return;
          setMessages((prev) => prev.filter((m) => m.id !== id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchProfile, scrollIfNearBottom]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = content.trim();
      if (!text || submitting || !user || closed) return;
      setErrorMsg(null);
      setSubmitting(true);

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const cached = profileCacheRef.current.get(user.id);
      const optimisticProfile: AuxProfile = cached ??
        (myProfile
          ? { id: myProfile.id, username: myProfile.username, display_name: myProfile.display_name, avatar_url: myProfile.avatar_url, role: myProfile.role }
          : { id: user.id, username: "you", display_name: null, avatar_url: null, role: "user" });
      const optimistic: AuxMessageWithProfile = {
        id: tempId,
        room_id: roomId,
        user_id: user.id,
        content: text,
        created_at: new Date().toISOString(),
        profile: optimisticProfile,
      };
      setMessages((prev) => [...prev, optimistic]);
      setPendingIds((s) => new Set(s).add(tempId));
      setContent("");
      scrollIfNearBottom();

      try {
        const res = await fetch(`/api/aux-battles/${roomId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? t("sendFailed"));
        }
        const data = (await res.json()) as { message: AuxMessageWithProfile };
        profileCacheRef.current.set(data.message.user_id, data.message.profile);
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev.filter((m) => m.id !== tempId);
          return prev.map((m) => (m.id === tempId ? data.message : m));
        });
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setErrorMsg(err instanceof Error ? err.message : t("sendFailed"));
      } finally {
        setPendingIds((s) => {
          const n = new Set(s);
          n.delete(tempId);
          return n;
        });
        setSubmitting(false);
      }
    },
    [content, submitting, user, closed, roomId, myProfile, scrollIfNearBottom, t]
  );

  const handleDelete = useCallback(
    async (m: AuxMessageWithProfile) => {
      const isOwn = m.user_id === (user?.id ?? "");
      if (!isOwn) {
        const name = m.profile.display_name || m.profile.username;
        if (!window.confirm(t("confirmDelete", { name }))) return;
      }
      const res = await fetch(`/api/aux-battles/${roomId}/messages/${m.id}`, { method: "DELETE" });
      if (res.ok) setMessages((prev) => prev.filter((x) => x.id !== m.id));
    },
    [user?.id, roomId, t]
  );

  const visible = messages.filter((m) => !blockedIds.has(m.user_id));
  const realCount = visible.filter((m) => !m.id.startsWith("temp-")).length;

  return (
    <section
      className={
        isSheet
          ? `h-full flex flex-col px-4 pt-3 pb-3 space-y-3 relative overflow-hidden ${className}`
          : `panel-xbox p-4 sm:p-5 space-y-3 relative overflow-hidden flex flex-col ${className}`
      }
    >
      <div className="flex items-center gap-2">
        <span className="glow-orb" style={{ animationDelay: "1s" }} />
        <span className="label-xbox">{t("title")}</span>
        <span className="text-xs text-text-muted">({realCount})</span>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t("collapse")}
            className="ml-auto w-8 h-8 rounded-full border border-border-medium text-text-secondary hover:text-accent-primary hover:border-accent-primary/60 transition-colors flex items-center justify-center"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
      <div className="divider-glow" />

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={t("messagesAria")}
        // Panel on a phone: a capped window, the page scrolls past it.
        // Panel on xl: the cap lifts and the list absorbs the column's
        // full height (Luca 2026-09-14: the side room should be the
        // same length as the main one, not a short floating card).
        // Sheet: flex to whatever height the sheet has.
        className={`overflow-y-auto pr-1 space-y-3 ${
          isSheet
            ? "flex-1 min-h-0"
            : "max-h-[min(60vh,520px)] min-h-[220px] xl:max-h-none xl:flex-1 xl:min-h-0"
        }`}
      >
        {visible.length === 0 ? (
          <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center gap-3 py-8">
            <span className="osd-text text-sm">{t("deadAir")}</span>
            <p className="text-sm text-text-muted max-w-xs">{t("nobody")}</p>
          </div>
        ) : (
          visible.map((m) => (
            <div key={m.id} className="flex gap-2.5 items-start group">
              <AuxAvatar profile={m.profile} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <UserLink
                    username={m.profile.username}
                    className="text-xs font-bold text-text-primary hover:text-accent-primary transition-colors font-[family-name:var(--font-heading)] truncate max-w-[10rem]"
                  >
                    {m.profile.display_name || m.profile.username}
                  </UserLink>
                  <VerifiedBadge role={m.profile.role} />
                  {m.user_id === hostId && (
                    <span className="pixel-text text-[9px] uppercase px-1 rounded border border-osd-amber/50 text-osd-amber">
                      {t("host")}
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted tabular-nums">
                    {timeAgo(m.created_at, tick, t("justNow"), locale)}
                  </span>
                  {pendingIds.has(m.id) && (
                    <span className="text-[10px] text-text-muted italic">{t("sending")}</span>
                  )}
                  {(m.user_id === (user?.id ?? "") || isStaff || isHost) && !m.id.startsWith("temp-") && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(m)}
                      aria-label={t("deleteMessage")}
                      className="pixel-text text-[10px] uppercase tracking-widest text-text-muted hover:text-accent-rose transition-colors"
                    >
                      ✕
                    </button>
                  )}
                  {m.user_id !== (user?.id ?? "") && !m.id.startsWith("temp-") && (
                    <ReportButton targetType="aux_message" targetId={m.id} small />
                  )}
                </div>
                <p className="text-sm text-text-secondary leading-snug whitespace-pre-wrap break-words mt-0.5">
                  {m.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="divider-glow" />

      {closed ? (
        <p className="text-center text-xs text-text-muted py-2 pixel-text uppercase">{t("archived")}</p>
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
            placeholder={t("placeholder")}
            rows={1}
            maxLength={500}
            aria-label={t("inputAria")}
            className="form-input resize-none"
          />
          {errorMsg && <p className="text-xs text-accent-rose">{errorMsg}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-text-muted tabular-nums">{content.length}/500</span>
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="btn-y2k btn-y2k-primary !py-1.5 !px-4 !text-xs disabled:opacity-40"
            >
              {submitting ? "…" : t("send")}
            </button>
          </div>
        </form>
      ) : (
        <div className="card-y2k p-4 text-center">
          <Link href="/login" className="btn-y2k btn-y2k-outline !py-1.5 !px-4 !text-xs">
            {t("signIn")}
          </Link>
        </div>
      )}
      {/* Scan bar — panel only; the sheet keeps its own bottom edge. */}
      {!isSheet && <div className="scan-bar" />}
    </section>
  );
}
