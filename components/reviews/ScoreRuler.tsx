"use client";

/**
 * ScoreRuler — the "whole album" score picker (Luca 2026-10-24: the
 * rating flow redo, "10x better").
 *
 * A big number on top, and under it a ruler you drag sideways — like
 * the zoom dial in the iPhone camera. The ruler moves WITH your finger
 * and the centre needle reads the score, one tick per 0.1. Every tick
 * crossed fires a light haptic in the app, and the number + needle
 * change colour through the rating scale as you go.
 *
 * Other ways in, so nobody has to drag: tap the number to type it,
 * scroll the mouse wheel over the ruler, or use the arrow keys
 * (←/→ = 0.1, PageUp/PageDown = 1, Home/End = 0/10).
 *
 * This replaced the plain range slider. Song-by-song scoring lives in
 * TrackScoreList; both share ScoreNumber below.
 */

import { useEffect, useRef, useState } from "react";
import { formatRating, getRatingColor, getRatingHex } from "@/lib/rating";
import { hapticTap } from "@/lib/native";

/** Pixels between whole numbers on the ruler (0.1 = a tenth of this).
 *  Was 66, which made 0 → 10 about two phone-widths of dragging (Luca
 *  2026-10-24: "too large and can take forever"). At 34 the whole
 *  scale is one swipe across a phone, and a tap jumps straight to the
 *  spot you tapped. */
const PX_PER_POINT = 34;

const clamp = (v: number) => Math.min(10, Math.max(0, Math.round(v * 10) / 10));

interface ScoreRulerProps {
  value: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}

export default function ScoreRuler({ value, onChange, ariaLabel }: ScoreRulerProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(null);
  const color = getRatingHex(value);

  // The strip is positioned from the box's real width, so it stays
  // centred on phones, the Duo's inner screen and desktop alike.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel needs a non-passive listener to stop the page scrolling
  // while the ruler turns.
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const steps = Math.trunc(acc / 24);
      if (steps !== 0) {
        acc -= steps * 24;
        set(valueRef.current + steps / 10);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(v: number) {
    const next = clamp(v);
    if (next !== valueRef.current) {
      // one light tick per 0.1 crossed — the camera-dial feel (no-op on web)
      hapticTap();
      onChange(next);
    }
  }

  const ticks = [];
  for (let i = 0; i <= 100; i++) {
    const major = i % 10 === 0;
    const half = i % 5 === 0;
    ticks.push(
      <span
        key={i}
        className={`score-ruler-tick${major ? " is-major" : half ? " is-half" : ""}`}
        style={{ left: (i / 10) * PX_PER_POINT }}
      >
        {major && <b>{i / 10}</b>}
      </span>
    );
  }

  return (
    <div
      ref={boxRef}
      className="score-ruler"
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-valuenow={value}
      aria-valuetext={formatRating(value)}
      onKeyDown={(e) => {
        const step =
          e.key === "ArrowRight" || e.key === "ArrowUp" ? 0.1
          : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -0.1
          : e.key === "PageUp" ? 1
          : e.key === "PageDown" ? -1
          : null;
        if (step !== null) { e.preventDefault(); set(value + step); }
        else if (e.key === "Home") { e.preventDefault(); set(0); }
        else if (e.key === "End") { e.preventDefault(); set(10); }
      }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, start: value, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        if (Math.abs(e.clientX - drag.current.x) > 4) drag.current.moved = true;
        // The ruler follows the finger: drag left → higher numbers
        // slide under the needle.
        set(drag.current.start - (e.clientX - drag.current.x) / PX_PER_POINT);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        // A tap (no drag) jumps to the number you tapped: tap the "8"
        // and the score is 8. The needle sits in the middle, so the
        // distance from the middle is the difference.
        if (d && !d.moved) {
          const r = e.currentTarget.getBoundingClientRect();
          set(d.start + (e.clientX - r.left - r.width / 2) / PX_PER_POINT);
        }
      }}
      onPointerCancel={() => { drag.current = null; }}
    >
      <div
        className="score-ruler-strip"
        style={{ transform: `translateX(${width / 2 - value * PX_PER_POINT}px)` }}
      >
        {ticks}
      </div>
      <span
        className="score-ruler-needle"
        style={{ background: color, boxShadow: `0 0 12px ${color}` }}
      />
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
