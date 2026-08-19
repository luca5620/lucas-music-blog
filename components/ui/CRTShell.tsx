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
        <div className="crt-screen">{children}</div>
      </div>
    </div>
  );
}
