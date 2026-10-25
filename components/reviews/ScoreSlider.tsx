"use client";

/**
 * ScoreSlider — the score picker in the review form, for the whole
 * album AND for every song in song-by-song mode.
 *
 * History (all 2026-10-24): plain slider → camera-dial ruler + slide-
 * the-whole-row songs ("not very precise and feels off") → the plain
 * slider + − / + buttons (still "off", and he didn't like the buttons)
 * → Luca tried four live mockups and picked option A, "jump to your
 * finger". That's this:
 *
 *   ●━━━━━━━━━━━━━━○──────     (the bar LOOKS thin: 6px)
 *   ↕ 52px of touch area around it — grab it anywhere, no aiming
 *
 * - Touch anywhere on the strip and the dot jumps there, then follows
 *   the finger smoothly (it glides; the number rounds to 0.1).
 * - The dot grows a little while held, so you can see you've got it.
 * - Vertical swipes still scroll the page. On a phone the jump only
 *   happens once the finger lifts (a tap) or clearly moves sideways,
 *   so scrolling past a song row never changes its score.
 * - Every 0.1 crossed fires one light haptic in the app (no-op on web).
 * - Arrow keys work when it has focus (desktop).
 *
 * `value` can be null (a song that isn't scored yet): no fill, a grey
 * dot in the middle, and the first tap or slide scores it.
 */

import { useRef, useState } from "react";
import { formatRating, getRatingColor, getRatingHex } from "@/lib/rating";
import { hapticTap } from "@/lib/native";

const round = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number) => Math.min(10, Math.max(0, v));

/** Inset of the bar inside the touch strip — the dot's radius plus a
 *  little, so a 0 or a 10 doesn't hang off the edge. Matches the
 *  left/right of .score-strip-track in globals.css. */
const INSET = 10;

interface ScoreSliderProps {
  value: number | null;
  onChange: (v: number) => void;
  ariaLabel: string;
  /** show the 0 · 5 · 10 under the bar (the big album slider does) */
  scale?: boolean;
}

export default function ScoreSlider({ value, onChange, ariaLabel, scale = false }: ScoreSliderProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  // `live` = the dot's continuous position while a finger is on it
  // (null = at rest, the dot sits on `value`).
  const [live, setLive] = useState<number | null>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    /** sideways drag confirmed (or a mouse) — the dot follows */
    on: boolean;
    /** the last rounded score sent up */
    sent: number | null;
  } | null>(null);

  /** Score under a screen x position. */
  function posAt(clientX: number) {
    const r = stripRef.current!.getBoundingClientRect();
    return clamp(((clientX - r.left - INSET) / (r.width - INSET * 2)) * 10);
  }

  /** Move the dot; send the rounded score up when it changes. */
  function follow(pos: number) {
    const d = drag.current!;
    setLive(pos);
    const score = round(pos);
    if (score !== d.sent && score !== value) {
      d.sent = score;
      hapticTap();
      onChange(score);
    }
  }

  const shown = live ?? value ?? 5;
  const score = live !== null ? round(live) : value;
  const color = score === null ? "rgba(255, 255, 255, 0.35)" : getRatingHex(score);
  const pct = shown * 10;
  const tier =
    score === null ? "" : score === 10 ? " is-perfect" : score >= 9.5 ? " is-elite" : "";

  return (
    <div className="score-strip-wrap">
      <div
        ref={stripRef}
        className={`score-strip${live !== null ? " is-held" : ""}${tier}`}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value === null ? "–" : formatRating(value)}
        onKeyDown={(e) => {
          const step =
            e.key === "ArrowRight" || e.key === "ArrowUp" ? 0.1
            : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -0.1
            : e.key === "PageUp" ? 1
            : e.key === "PageDown" ? -1
            : null;
          if (step === null) return;
          e.preventDefault();
          onChange(round(clamp((value ?? 5) + step)));
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          // A mouse can't be scrolling the page, so it jumps right away.
          // A finger waits to see whether it's a tap, a slide or a scroll.
          const mouse = e.pointerType === "mouse";
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, on: mouse, sent: null };
          if (mouse) {
            e.currentTarget.setPointerCapture(e.pointerId);
            follow(posAt(e.clientX));
          }
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          if (!d.on) {
            const dx = Math.abs(e.clientX - d.x);
            const dy = Math.abs(e.clientY - d.y);
            if (dy > 8 && dy > dx) { drag.current = null; return; } // a scroll
            if (dx < 4) return;
            d.on = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          follow(posAt(e.clientX));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          // a tap: jump to where the finger was
          if (!d.on) follow(posAt(e.clientX));
          drag.current = null;
          setLive(null);
        }}
        onPointerCancel={() => {
          // The phone took the touch (usually a scroll). Whatever score
          // was already sent stays — it's what they slid to.
          drag.current = null;
          setLive(null);
        }}
      >
        <span className="score-strip-track">
          {score !== null && (
            <span
              className="score-strip-fill"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}40, ${color}cc)` }}
            />
          )}
        </span>
        <span className="score-strip-ticks" aria-hidden="true">
          {Array.from({ length: 21 }, (_, i) => (
            <i key={i} style={{ left: `${i * 5}%` }} className={i % 2 ? "is-half" : ""} />
          ))}
        </span>
        <span
          className="score-strip-dot"
          style={{
            left: `calc(${INSET}px + (100% - ${INSET * 2}px) * ${shown / 10})`,
            background: color,
            boxShadow: score === null ? "none" : `0 0 6px ${color}`,
          }}
        />
      </div>
      {scale && (
        <div className="score-strip-scale font-[family-name:var(--font-vt323)]">
          <span>0</span>
          <span>5</span>
          <span>10</span>
        </div>
      )}
    </div>
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
    if (Number.isFinite(n) && onChange) onChange(round(clamp(n)));
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
