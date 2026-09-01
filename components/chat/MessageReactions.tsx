"use client";

/**
 * MessageReactions — the like row under a single chat message.
 *
 * 2026-08-31 (Luca's universal-like pass): the multi-emoji strip +
 * picker is GONE — every comment across the site now carries one
 * heart, same as reviews/posts/lists. This kept the whole reaction
 * pipeline (tables, routes, realtime, useMessageReactions) untouched:
 * a like is simply a reaction with the canonical ❤️ emoji, so old ❤️
 * reactions carry over as likes and other legacy emojis just stop
 * rendering. Richer reactions can return later by rendering more of
 * the counts again.
 *
 * Purely presentational: counts/toggling live in the parent via
 * useMessageReactions — this component renders and reports clicks.
 */

import { hapticTap } from "@/lib/native";

/** The one canonical reaction the UI writes now. */
export const LIKE_EMOJI = "❤️";

interface MessageReactionsProps {
  /** emoji -> count. Only the ❤️ entry renders (see header note). */
  counts: Record<string, number>;
  /** Emojis the viewer has reacted with on this message. */
  mine: ReadonlySet<string>;
  /** False for signed-out viewers and optimistic (temp) messages. */
  canReact: boolean;
  onToggle: (emoji: string) => void;
  /** Kept for call-site compatibility; the heart is always rose. */
  accentColor?: string;
}

export default function MessageReactions({
  counts,
  mine,
  canReact,
  onToggle,
}: MessageReactionsProps) {
  const count = counts[LIKE_EMOJI] ?? 0;
  const liked = mine.has(LIKE_EMOJI);

  // Nothing to show: no likes yet and the viewer can't add one.
  if (count === 0 && !canReact) return null;

  const toggle = () => {
    hapticTap(); // physical tap in the app; no-op on web
    onToggle(LIKE_EMOJI);
  };

  return (
    <div className="flex items-center mt-1">
      <button
        type="button"
        disabled={!canReact}
        onClick={toggle}
        aria-pressed={liked}
        aria-label={liked ? "Unlike message" : "Like message"}
        className={`inline-flex items-center gap-1 ${
          liked ? "text-[#ff4d6d]" : "text-text-muted hover:text-[#ff4d6d]"
        } transition-colors select-none disabled:cursor-default`}
      >
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill={liked ? "#ff4d6d" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={
            liked
              ? { filter: "drop-shadow(0 0 4px rgba(255,77,109,0.7))" }
              : undefined
          }
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {count > 0 && (
          <span className="font-[family-name:var(--font-heading)] font-bold tabular-nums text-[10px]">
            {count}
          </span>
        )}
      </button>
    </div>
  );
}
