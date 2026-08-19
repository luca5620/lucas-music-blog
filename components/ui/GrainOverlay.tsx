/**
 * GrainOverlay — subtle CRT atmosphere: soft film grain, faint
 * scanlines, and a barely-there aperture grille. All layers are
 * fixed-position, pointer-transparent, dialed low so true-black
 * OLED pixels stay dark, and honor prefers-reduced-motion.
 */
export default function GrainOverlay() {
  return (
    <>
      <div className="grain-overlay" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="aperture-grille" aria-hidden="true" />
    </>
  );
}
