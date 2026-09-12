import LiquidField from "@/components/ui/LiquidField";

/**
 * CRTShell — the frame every page renders inside.
 * A slim plastic bezel around a true-black screen, with the classic
 * game-disc-box spine down the left: vertical "Peak Music" in the
 * PlayStation font and the ESRB-style "R for Real" rating badge.
 * The spine hides on phones (see globals.css).
 */
export default function CRTShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="crt-tv">
      {/* APP-ONLY (display:none on web): the ONE liquid field for the
          whole app surface. In the shell the screen is transparent
          over the same black, so this layer glows through the borders
          AND behind the modules as a single unbroken material — no
          edge for the light to get clipped by (Luca 2026-08-24).
          Colors ride --liquid-1/2/3, so profile themes and album
          covers recolor it like every other liquid layer. The canvas
          is viewport-sized and sticky inside this page-tall layer;
          it moves only while html.motion-on (thermal mode). */}
      <div className="crt-bezel-liquid" aria-hidden="true">
        <LiquidField context="site" sticky />
      </div>
      {/* NO status-bar scrim (Luca 2026-08-28: the solid band read as
          a flat black strip over the liquid). The status-bar zone is
          the same surface as everything else — the wash flows through
          it; scrolled content passes under the clock. */}
      <div className="crt-body">
        {/* Left spine — the disc-box edge */}
        <div className="crt-spine" aria-hidden="true">
          <span className="crt-spine-brand">Peak Music</span>
          <div className="crt-spine-rating">
            <span className="crt-rating-letter">R</span>
            <span className="crt-rating-text">Real</span>
          </div>
        </div>

        {/* The screen — all site content */}
        <div className="crt-screen">
          {/* WEB: the site-wide wash behind everything on the screen.
              One viewport-sized canvas, sticky inside this page-tall
              layer, clipped to the screen's rounded corners. Nothing
              here is positioned in % of the page height, so the
              streamed feeds arriving never shift it (the old blob
              string once scored a 0.65 layout shift for that). */}
          <div className="crt-liquid" aria-hidden="true">
            <LiquidField context="site" sticky />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
