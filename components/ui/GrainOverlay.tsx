/**
 * GrainOverlay — Adds film grain + CRT scan line effects over the entire page.
 * These are purely decorative, fixed-position, and ignore all pointer events
 * so they never interfere with clicking or scrolling.
 */
export default function GrainOverlay() {
  return (
    <>
      {/* Film grain noise texture */}
      <div className="grain-overlay" aria-hidden="true" />
      {/* CRT horizontal scan lines */}
      <div className="scanlines" aria-hidden="true" />
    </>
  );
}
