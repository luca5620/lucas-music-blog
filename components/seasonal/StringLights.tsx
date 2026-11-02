/**
 * StringLights — Christmas 2026 lights strung across the very top of
 * the screen (Luca, 2026-11-02). Rendered by app/layout.tsx only while
 * lib/season.ts says it's the season.
 *
 * Round two of the lights. Luca's notes on the first version: it
 * "doesn't go through the whole top of the screen", it should "stay up
 * there" when you scroll (like the status-bar zone does in the app),
 * it was "a little too basic", and he wanted "some subtle lighting
 * effects, maybe just in off low-detail mode". So:
 *   - FIXED to the top of the viewport, full width, above everything
 *     but never catching a tap. In the app it hangs just under the
 *     status bar (clock/battery) so it never covers them; on the
 *     website it hangs across the top of the browser window, above
 *     the TV.
 *   - Art lives in public/seasonal/ as tiles that repeat every 200px:
 *     a twisted two-strand wire (SVG), and Luca's generated C9 bulbs
 *     (2026-11-02, docs/marketing/christmas-2026-art.md) split into two
 *     layers — red + green, amber + blue — drawn at 2x as WebP, which
 *     blink out of step so neighbouring bulbs alternate.
 *   - GLOW (full detail only — low detail is on by default and this is
 *     the costly part): a soft coloured halo under each bulb, pulsing
 *     in step with it, washing a little light onto the page below.
 *   - Reduce Motion: the lights stay, lit and still.
 * Everything here is CSS (globals.css, "CHRISTMAS 2026 — LIGHTS").
 */
export default function StringLights() {
  return (
    <div className="xmas-lights" aria-hidden="true">
      <i className="xmas-glow-a" />
      <i className="xmas-glow-b" />
      <i className="xmas-wire" />
      <i className="xmas-bulbs-a" />
      <i className="xmas-bulbs-b" />
    </div>
  );
}
