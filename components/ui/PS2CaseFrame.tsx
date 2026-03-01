/**
 * PS1CaseFrame — Wraps all site content in a PlayStation 1 game case aesthetic.
 * Left spine with "Peak Music" branding (PlayStation font) and "R for Real" rating badge.
 */
export default function PS1CaseFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="ps1-case mx-4 md:mx-8 lg:mx-auto">
      {/* Left spine — main feature with branding + rating */}
      <div className="ps1-spine">
        <span className="ps1-spine-brand">Peak Music</span>

        {/* ESRB-style rating badge */}
        <div className="ps1-spine-rating">
          <span className="ps1-rating-letter">R</span>
          <span className="ps1-rating-text">Real</span>
        </div>
      </div>

      {/* Cover art area — all site content goes here */}
      <div className="ps1-cover">{children}</div>
    </div>
  );
}
