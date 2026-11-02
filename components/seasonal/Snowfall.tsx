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
 * Two looks (Luca, 2026-11-02: "when low detail mode is off I would
 * want a more detailed like snowflake"):
 *   - FULL DETAIL: each flake is a six-armed crystal with side branches
 *     (an SVG drawn in globals.css), 8–16px, turning slowly as it falls.
 *   - LOW DETAIL (on by default — so it can't simply turn snow off, or
 *     almost nobody would see it): plain 2–4px dots, and only the first
 *     8 of them, falling more slowly.
 *   - REDUCE MOTION (an accessibility preference): no snow at all.
 * Both are transform-only animations the GPU composites without
 * repainting the page. Each flake carries its size as --s (2–4); CSS
 * turns that into a dot or a crystal.
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
            // The flake's scale, read by globals.css: a 2–4px dot in low
            // detail, a crystal 4× that size with full effects on.
            ["--s" as string]: size,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}
