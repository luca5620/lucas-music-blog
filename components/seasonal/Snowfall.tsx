/**
 * Snowfall — the Christmas 2026 snow (Luca, 2026-11-02: "the snow
 * effect around the website"). Rendered by app/layout.tsx only while
 * lib/season.ts says it's the season.
 *
 * Pure CSS, no JavaScript: a fixed layer of small round flakes, each
 * falling on its own loop (globals.css, "CHRISTMAS 2026 — SNOW"). It
 * is decoration only: aria-hidden, pointer-events none, and it sits
 * UNDER the CRT's scanlines and aperture grille so the snow looks like
 * it's on the TV picture, not stuck to the glass.
 *
 * Cost: transform-only animations on a handful of 2–4px dots, which
 * the GPU composites without repainting the page. Even so:
 *   - LOW DETAIL (on by default — so it can't simply turn snow off,
 *     or almost nobody would see it): only the first 8 flakes fall,
 *     more slowly. Same trade the penguin's greeting makes.
 *   - REDUCE MOTION (an accessibility preference): no snow at all.
 *
 * The flake list is fixed (not random) so the server and the browser
 * render the same markup — no hydration mismatch, no layout shift.
 */

/** left (vw %), size (px), fall time (s), start offset (s, negative = already mid-fall). */
const FLAKES: [number, number, number, number][] = [
  [4, 3, 13, -2], [11, 2, 16, -9], [19, 4, 11, -5], [27, 2, 15, -12],
  [35, 3, 12, -1], [43, 2, 17, -7], [51, 4, 13, -10], [59, 3, 11, -4],
  [66, 2, 16, -14], [73, 3, 12, -6], [80, 2, 15, -3], [87, 4, 12, -11],
  [94, 2, 14, -8], [15, 3, 18, -15], [47, 2, 19, -13], [69, 3, 17, -16],
  [31, 2, 20, -18], [90, 3, 18, -17],
];

export default function Snowfall() {
  return (
    <div className="xmas-snow" aria-hidden="true">
      {FLAKES.map(([left, size, duration, delay], i) => (
        <span
          key={i}
          style={{
            left: `${left}%`,
            width: size,
            height: size,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}
