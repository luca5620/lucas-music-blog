/**
 * DSCaseFrame — Nintendo DS game case frame.
 * Replaces the old CRT monitor bezel.
 *
 * The site content sits inside the "cover art" area of a DS case,
 * with a wider left spine showing "NINTENDO DS" vertically.
 * The ds-cover div uses `contain: paint` so the TV channel-change
 * transition stays clipped inside the cover area.
 */

export default function DSCaseFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="ds-case mx-4 md:mx-8 lg:mx-auto">
      {/* Left spine — wider strip with vertical branding (like a real DS case) */}
      <div className="ds-spine">
        <span className="ds-spine-text">Nintendo DS</span>
      </div>

      {/* Cover art area — all site content goes here */}
      <div className="ds-cover">{children}</div>
    </div>
  );
}
