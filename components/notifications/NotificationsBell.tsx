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
    // Follow-feed (033): these read as news, not as flattery.
    case "new_review":
      return `posted a review of${t}`;
    case "new_post":
      return `posted${t}`;
    case "new_list":
      return `made a new list${t}`;
    case "new_debate":
      return `started a debate${t}`;
    default:
      return "did something";
  }
}

export default function NotificationsBell() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  // How far rightward (px) to shift the panel so it hugs the screen's
  // right edge instead of the bell's — see toggle().
  const [panelShift, setPanelShift] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Written as a promise chain rather than async/await on purpose:
  // the state writes live inside the .then callback, which makes it
  // plain to the React Compiler lint that they run after the network
  // answers — never synchronously inside the effect that calls this.
  const fetchAll = useCallback(() => {
    return fetch("/api/notifications")
      .then((res) =>
        res.ok
          ? (res.json() as Promise<{
              notifications?: NotificationRow[];
              unread?: number;
            }>)
          : null
      )
      .then((data) => {
        if (!data) return;
        setItems(data.notifications ?? []);
        setUnread(data.unread ?? 0);
      })
      .catch(() => {
        /* offline / pre-migration — the bell just stays quiet */
      });
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
    if (next) {
      // APP ONLY: the panel is anchored right-0 to the BELL, but in
      // the app the bell sits left of CREATE + avatar — a 300px box
      // extending left from there ran off the screen edge (Luca
      // 2026-08-28: "cuts off a bit on the left"). Measure once on
      // open and shift the panel right so its right edge lands 12px
      // from the screen's; combined with the viewport-capped width
      // below it can never clip on either side.
      // On the WEB this same math is what threw the panel "way off"
      // (Luca 2026-08-31): innerWidth spans the whole browser window
      // — CRT bezel, room side bars and all — so the shift pushed the
      // panel far past the content area. The web bell sits at the
      // right edge of the nav already; a plain drop straight under it
      // (shift 0) is correct there.
      const isApp = document.documentElement.classList.contains("native-app");
      const r = boxRef.current?.getBoundingClientRect();
      if (isApp && r) {
        setPanelShift(
          Math.max(0, Math.round(window.innerWidth - r.right - 12))
        );
      } else {
        setPanelShift(0);
      }
    }
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
        // Same pill as SEARCH/CREATE (Luca 2026-08-28: matching size
        // + shape) — identical paddings/radius/typography, and on the
        // web the "Alerts" label at sm+ gives it the same height and
        // width as its two neighbors. Neutral coloring so CREATE
        // stays the accented action. nav-pill-btn = the app's
        // tightened padding; the label is hidden below sm, so the
        // approved app row is untouched.
        className="nav-pill-btn relative inline-flex items-center justify-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold tracking-wide uppercase whitespace-nowrap text-text-secondary hover:text-accent-primary border border-white/10 hover:border-accent-primary/50 transition-all duration-200 font-[family-name:var(--font-heading)]"
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
        {/* Web-only label — gives the pill the same height/width as
            Search and Create; below sm (and so in the app) the bell
            stays icon-only. */}
        <span className="hidden sm:inline">Alerts</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-rose text-white text-[10px] font-bold flex items-center justify-center border border-black/40">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="menu-sheet absolute top-full mt-2 w-[min(19rem,calc(100vw-1.5rem))] bg-[#141418] border border-white/10 rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.7)] z-50 overflow-hidden"
          style={{ right: -panelShift }}
        >
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
