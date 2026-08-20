/**
 * ChromeDisc — the site's chrome CD, built entirely in CSS (no
 * images, no WebGL): conic-gradient chrome with two diffraction
 * rainbow slivers, repeating radial track grooves, a clear-plastic
 * hub, slow spin. Two variants:
 *
 *  - "hero": large, tilted in perspective like a product render,
 *    crossed by two neon-green laser lines (the Desktop.fm scene)
 *  - "mini": small flat spinner for section headers — a "now
 *    playing" punctuation mark
 *
 * Purely decorative — always aria-hidden. Styles live in
 * globals.css under CHROME DISC + LIQUID LIGHT.
 */
export default function ChromeDisc({
  variant = "hero",
  className = "",
}: {
  variant?: "hero" | "mini";
  className?: string;
}) {
  if (variant === "mini") {
    return (
      <span className={`cd-stage cd-mini block ${className}`} aria-hidden="true">
        <span className="cd-disc block" />
      </span>
    );
  }

  return (
    <div className={`cd-stage ${className}`} aria-hidden="true">
      <div className="cd-tilt">
        <div className="cd-disc" />
      </div>
      <span className="cd-laser cd-laser-1" />
      <span className="cd-laser cd-laser-2" />
    </div>
  );
}
