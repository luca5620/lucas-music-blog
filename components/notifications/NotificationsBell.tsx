"use client";

/**
 * NotificationsBell — the header bell (migration 025).
 *
 * Polls /api/notifications once a minute (plus on tab-refocus),
 * shows the unread count as a badge, and opens a dropdown of the
 * latest 25. Opening the panel marks everything read — the badge
 * zeroes instantly, the rows keep a subtle unread tint until the
 * next fetch.
 *
 * This is the web/in-app half of notifications; the post-approval
 * native rebuild adds push on top of the same rows (see migration
 * 025's header note).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NotificationRow } from "@/lib/db/notifications";

const POLL_MS = 60_000;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** "slim liked your review of Take Care" — the verb line per type. */
function message(n: NotificationRow): string {
  const t = n.title ? ` "${n.title}"` : "";
  switch (n.type) {
    case "follow":
      return "started following you";
    case "review_like":
      return `liked your review of${t}`;
    case "comment":
      return `commented on your review of${t}`;
    case "comment_reply":
      return `replied to your comment on${t}`;
    case "post_like":
      return `liked your post${t}`;
    case "list_like":
      return `liked your list${t}`;
    default:
      return "did something";
  }
}

export default function NotificationsBell() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications?: NotificationRow[];
        unread?: number;
      };
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      /* offline / pre-migration — the bell just stays quiet */
    }
  }, []);

  // Initial load + poll + refetch when the tab comes back.
  useEffect(() => {
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchAll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchAll]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // Optimistic: badge clears now, server catches up best-effort.
      setUnread(0);
      void fetch("/api/notifications", { method: "POST" }).catch(() => {});
    }
  }

  return (
    <div className="relative shrink-0" ref={boxRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={
          unread > 0 ? `Notifications (${unread} unread)` : "Notifications"
        }
        // Same pill as the CREATE button (Luca 2026-08-28: matching
        // size + shape, one clean row) — identical paddings/radius,
        // neutral coloring so CREATE stays the accented action.
        // nav-pill-btn = the app's tightened padding, same as CREATE.
        className="nav-pill-btn relative inline-flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-text-secondary hover:text-accent-primary border border-white/10 hover:border-accent-primary/50 transition-all duration-200"
      >
        {/* Bell — same 3.5 icon size as CREATE's plus */}
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-rose text-white text-[10px] font-bold flex items-center justify-center border border-black/40">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] bg-[#141418] border border-white/10 rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.7)] z-50 overflow-hidden">
          <p className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-white/10 font-[family-name:var(--font-heading)]">
            Notifications
          </p>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted text-center">
              Nothing yet — go start some noise.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-white/5">
              {items.map((n) => {
                const actor = n.actor;
                const name = actor?.display_name || actor?.username || "Someone";
                return (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${
                      n.read ? "" : "bg-accent-primary/5"
                    }`}
                  >
                    {actor?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={actor.avatar_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-xs font-bold text-accent-primary uppercase shrink-0">
                        {name[0]}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-text-secondary leading-snug">
                        <span className="font-bold text-text-primary">
                          {name}
                        </span>{" "}
                        {message(n)}
                      </span>
                      <span className="block text-[11px] text-text-muted mt-0.5">
                        {timeAgo(n.created_at)} ago
                      </span>
                    </span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-accent-primary mt-1.5 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
