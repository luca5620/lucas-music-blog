/**
 * LucasDefaultBio — Fallback bio block for the /profile/lucas page when the
 * profile's `bio` column is empty. Carries the about-page's intro/body
 * content verbatim so we can fold the old /about route in without requiring
 * a DB update. The user can override by setting their bio in /settings/profile.
 */

interface Props {
  accentColor: string;
}

const streamingLinks = [
  {
    name: "Spotify",
    url: "https://open.spotify.com/user/lucapivard5620",
    emoji: "🎵",
  },
  {
    name: "SoundCloud",
    url: "https://soundcloud.com/dope-oasis",
    emoji: "☁️",
  },
  {
    name: "stats.fm",
    url: "https://stats.fm/user/luca5620",
    emoji: "📊",
  },
];

export default function LucasDefaultBio({ accentColor }: Props) {
  return (
    <div className="space-y-5 max-w-2xl">
      <div
        className="card-y2k p-4 sm:p-6 space-y-5"
        style={{ borderColor: `${accentColor}33` }}
      >
        <div className="flex items-start gap-4 sm:gap-5">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0 border-2"
            style={{ borderColor: accentColor }}
          >
            <img
              src="/penguin-logo.png"
              alt="Peak Music Reviews"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-2 min-w-0">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text-primary">
              Luca
            </h2>
            <p className="pixel-text text-sm text-text-muted">aka lu-cuh</p>
            <p
              className="pixel-text text-sm mt-2"
              style={{ color: accentColor }}
            >
              Work in Progress
            </p>
          </div>
        </div>

        {/* Find Me On — streaming profiles */}
        <div className="space-y-2 pt-2 border-t border-border-subtle">
          <p className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            Find Me On
          </p>
          <div className="flex flex-wrap gap-2">
            {streamingLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-y2k btn-y2k-outline"
                style={{
                  borderColor: `${accentColor}50`,
                  color: accentColor,
                }}
              >
                <span>{link.emoji}</span>
                {link.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
