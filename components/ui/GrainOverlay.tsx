/**
 * GrainOverlay — the full CRT atmosphere stack: animated film
 * grain, horizontal scanlines, Trinitron-style aperture grille,
 * and a slow rolling vsync band. All layers are fixed-position,
 * pointer-transparent, and honor prefers-reduced-motion.
 */
export default function GrainOverlay() {
  return (
    <>
      <div className="grain-overlay" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="aperture-grille" aria-hidden="true" />
      <div className="vsync-band" aria-hidden="true" />
    </>
  );
}
