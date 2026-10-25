"use client";

/**
 * ScoreSlider — the score picker in the review form, for the whole
 * album AND for every song in song-by-song mode.
 *
 * History: it started as a plain slider (a bar with a dot you grab).
 * On 2026-10-24 it became a camera-dial ruler and the song rows became
 * "slide across the whole row" sliders — and Luca found both "not very
 * precise", because 0.1 was only ~3px of finger travel and the rows
 * jumped to wherever your finger first landed. Same day he picked
 * "original + fine-tune": the original slider back, plus − / + buttons.
 *
 *   [ − ]  ●━━━━━━━━━━━━━━○──────  [ + ]
 *          0         5          10
 *
 * - The slider only moves when you grab the dot, so touching it never
 *   throws your score somewhere else. Swipe = get close.
 * - − / + nudge by exactly 0.1. Hold one down and it keeps going.
 * - The bar fills in the score's colour; 9.5+ makes the dot pulse
 *   (the .rating-slider styles in globals.css, unchanged from before).
 * - Every 0.1 step fires one light haptic in the app (no-op on web).
 *
 * `value` can be null (a song that isn't scored yet): the dot sits
 * greyed out in the middle, and the first slide or tap scores it.
 */

import { useEffect, useRef, useState } from "react";
import { formatRating, getRatingColor, getRatingHex } from "@/lib/rating";
import { hapticTap } from "@/lib/native";

const clamp = (v: number) => Math.min(10, Math.max(0, Math.round(v * 10) / 10));

interface ScoreSliderProps {
  value: number | null;
  onChange: (v: number) => void;
  ariaLabel: string;
  /** aria-labels for the − / + buttons ("Lower by 0.1" / "Raise by 0.1") */
  downLabel: string;
  upLabel: string;
  /** show the 0 · 5 · 10 under the bar (the big album slider does) */
  scale?: boolean;
}

export default function ScoreSlider({
  value,
  onChange,
  ariaLabel,
  downLabel,
  upLabel,
  scale = false,
}: ScoreSliderProps) {
  // Held − / + buttons repeat from a timer, so they need the value as
  // it is NOW, not as it was when the press started.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  function set(v: number) {
    const next = clamp(v);
    if (next !== valueRef.current) {
      valueRef.current = next;
      hapticTap();
      onChange(next);
    }
  }

  // An unscored song nudges from the middle of the scale.
  const nudge = (dir: 1 | -1) => set((valueRef.current ?? 5) + dir * 0.1);

  const shown = value ?? 5;
  const color = value === null ? "#ffffff" : getRatingHex(value);
  const fill = value === null ? "rgba(255,255,255,0.08)" : `${color}30 0%, ${color}99 ${shown * 10}%`;

  return (
    <div className="score-slider">
      <Nudge label={downLabel} onStep={() => nudge(-1)}>−</Nudge>
      <div className="score-slider-bar">
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          value={shown}
          onChange={(e) => set(parseFloat(e.target.value))}
          className={`rating-slider${
            value === null
              ? " is-empty"
              : value === 10
                ? " rating-slider-perfect"
                : value >= 9.5
                  ? " rating-slider-elite"
                  : ""
          }`}
          style={
            {
              "--slider-color": color,
              background:
                value === null
                  ? fill
                  : `linear-gradient(90deg, ${fill}, rgba(255,255,255,0.08) ${shown * 10}%)`,
            } as React.CSSProperties
          }
          aria-label={ariaLabel}
          aria-valuetext={value === null ? "–" : formatRating(value)}
        />
        {scale && (
          <div className="flex justify-between text-xs text-text-muted font-[family-name:var(--font-vt323)]">
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
        )}
      </div>
      <Nudge label={upLabel} onStep={() => nudge(1)}>+</Nudge>
    </div>
  );
}

/**
 * One − or + button. A tap = one 0.1 step; hold it and after a short
 * pause it keeps stepping (like the volume buttons), so getting from
 * 6.0 to 6.9 doesn't take nine taps.
 */
function Nudge({
  label,
  onStep,
  children,
}: {
  label: string;
  onStep: () => void;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = () => clearTimeout(timer.current);
  useEffect(() => stop, []);

  return (
    <button
      type="button"
      className="score-nudge"
      aria-label={label}
      onPointerDown={(e) => {
        // stops the long-press text selection / callout on iPhone
        e.preventDefault();
        onStep();
        const repeat = (delay: number) => {
          timer.current = setTimeout(() => {
            onStep();
            repeat(70);
          }, delay);
        };
        repeat(420);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      // Keyboard (Enter / Space) has no pointer events; detail === 0
      // tells a keyboard "click" apart from a finger or mouse one.
      onClick={(e) => {
        if (e.detail === 0) onStep();
      }}
    >
      {children}
    </button>
  );
}

/**
 * ScoreNumber — the big score readout. Tap it to type an exact score
 * (the keyboard opens with a decimal pad); Enter or tapping away
 * saves, Escape cancels. Shows "–" when there's no score yet.
 */
export function ScoreNumber({
  value,
  onChange,
  typeLabel,
  size = "lg",
}: {
  value: number | null;
  onChange?: (v: number) => void;
  typeLabel: string;
  size?: "lg" | "md";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const color = value === null ? undefined : getRatingHex(value);
  const cls = `score-number score-number-${size}`;
  // The number sits in the site's own rating badge, blown up — so a
  // 9.5+ glows purple with its sparks, a 10 goes full white-blue, and
  // a 0–1.9 is the brown stinky one with the plumes (Luca 2026-10-24:
  // "should still have the charm … not just a regular ass number").
  const tier = value === null ? "" : getRatingColor(value);

  if (editing && onChange) {
    return (
      <input
        autoFocus
        inputMode="decimal"
        aria-label={typeLabel}
        className={`${cls} score-number-input`}
        value={draft}
        style={{ color }}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 4))}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  function commit() {
    const n = parseFloat(draft.replace(",", "."));
    if (Number.isFinite(n) && onChange) onChange(clamp(n));
    setEditing(false);
  }

  return (
    <button
      type="button"
      className={cls}
      style={{ color }}
      disabled={!onChange}
      aria-label={typeLabel}
      onClick={() => {
        setDraft(value === null ? "" : formatRating(value));
        setEditing(true);
      }}
    >
      <span className="score-badge-zoom">
        <span
          className={`rating-badge score-badge ${tier}`}
          style={color ? { color, borderColor: color } : undefined}
        >
          {value === null ? "–" : formatRating(value)}
        </span>
      </span>
      <small>/10</small>
    </button>
  );
}
