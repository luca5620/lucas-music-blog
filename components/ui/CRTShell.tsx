import ShellLiquid from "@/components/ui/ShellLiquid";

/**
 * CRTShell — the frame every page renders inside.
 * A slim plastic bezel around a true-black screen. (The game-case
 * spine that used to run down the left was removed 2026-10-25 —
 * option D: the screen takes the full width, and review pages put a
 * side rail in the room it freed.)
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
          is page-tall, composed at viewport scale, and moves only
          while html.motion-on (thermal mode). */}
      <div className="crt-bezel-liquid" aria-hidden="true">
        <ShellLiquid where="app" />
      </div>
      {/* NO status-bar scrim (Luca 2026-08-28: the solid band read as
          a flat black strip over the liquid). The status-bar zone is
          the same surface as everything else — the wash flows through
          it; scrolled content passes under the clock. */}
      <div className="crt-body">
        {/* The screen — all site content */}
        <div className="crt-screen">
          {/* WEB: the site-wide wash behind everything on the screen.
              One page-tall canvas composed at viewport scale (the
              hero crop up top, the environment continuing down behind
              the modules), clipped to the screen's rounded corners.
              Absolutely positioned, so streamed feeds arriving never
              shift anything (the old blob string once scored a 0.65
              layout shift for that). */}
          <div className="crt-liquid" aria-hidden="true">
            <ShellLiquid where="web" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
