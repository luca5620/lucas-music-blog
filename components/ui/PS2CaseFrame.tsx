/**
 * PS2CaseFrame — Wraps all site content in a PlayStation 2 game case aesthetic.
 * Navy blue top bar with "Peak Music" branding, left spine, ESRB-style rating badge.
 */
export default function PS2CaseFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="ps2-case mx-4 md:mx-8 lg:mx-auto">
      {/* Top bar — "Peak Music" branding (where PS2 logo would be) */}
      <div className="ps2-top-bar">
        <span className="ps2-brand">Peak Music</span>
      </div>

      {/* Main area — spine + cover */}
      <div className="ps2-main">
        {/* Left spine */}
        <div className="ps2-spine">
          <span className="ps2-spine-text">Peak Music Reviews</span>
        </div>

        {/* Cover art area — all site content goes here */}
        <div className="ps2-cover">
          {children}

          {/* ESRB-style rating badge */}
          <div className="ps2-rating">
            <span className="ps2-rating-letter">R</span>
            <span className="ps2-rating-text">Real</span>
          </div>
        </div>
      </div>
    </div>
  );
}
