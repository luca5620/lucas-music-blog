"use client";

/**
 * MessageReactions — the reaction strip under a single chat message.
 *
 * Purely presentational: chips for every emoji with a nonzero count
 * (highlighted when the viewer added it) plus an add-button that expands
 * an inline emoji picker. All counts/toggling live in the parent via
 * useMessageReactions — this component just renders and reports clicks.
 *
 * The picker expands inline rather than as a floating popover so it never
 * clips inside the overflow-y-auto message list.
 */

import { useState } from "react";

export const REACTION_EMOJIS = ["🔥", "💀", "🎯", "❤️", "🤧", "🥶"];

interface MessageReactionsProps {
  /** emoji -> count. Only entries with count > 0 render as chips. */
  counts: Record<string, number>;
  /** Emojis the viewer has reacted with on this message. */
  mine: ReadonlySet<string>;
  /** False for signed-out viewers and optimistic (temp) messages. */
  canReact: boolean;
  onToggle: (emoji: string) => void;
  accentColor?: string;
}

export default function MessageReactions({
  counts,
  mine,
  canReact,
  onToggle,
  accentColor = "#1e90ff",
}: MessageReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const chips = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));

  if (chips.length === 0 && !canReact) return null;

  const pick = (emoji: string) => {
    setPickerOpen(false);
    onToggle(emoji);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {chips.map(([emoji, count]) => {
        const isMine = mine.has(emoji);
        return (
          <button
            key={emoji}
            type="button"
            disabled={!canReact}
            onClick={() => onToggle(emoji)}
            aria-pressed={isMine}
            aria-label={`${emoji} — ${count} reaction${count === 1 ? "" : "s"}`}
            className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-xs transition-all disabled:cursor-default enabled:hover:scale-110"
            style={{
              background: isMine ? `${accentColor}26` : "rgba(255,255,255,0.04)",
              border: `1px solid ${isMine ? `${accentColor}80` : "rgba(255,255,255,0.08)"}`,
              color: isMine ? accentColor : undefined,
            }}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span className="font-[family-name:var(--font-heading)] font-bold tabular-nums text-[10px]">
              {count}
            </span>
          </button>
        );
      })}

      {canReact && (
        <>
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-expanded={pickerOpen}
            aria-label={pickerOpen ? "Close reaction picker" : "Add reaction"}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] leading-none text-text-muted border border-transparent hover:border-border-medium hover:text-text-secondary transition-all"
          >
            {pickerOpen ? "×" : "☺+"}
          </button>
          {pickerOpen && (
            <span className="inline-flex items-center gap-0.5">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => pick(emoji)}
                  aria-label={`React with ${emoji}`}
                  className="px-1 py-0.5 rounded text-base leading-none transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </span>
          )}
        </>
      )}
    </div>
  );
}
