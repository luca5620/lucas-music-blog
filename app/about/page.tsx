/**
 * About Page — Who Luca is, what this site is, the philosophy behind it.
 * Real profile links to Spotify, SoundCloud, and stats.fm.
 */

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

export default function About() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold text-accent-rose">
          About
        </h1>
        <p className="pixel-text text-lg text-accent-primary">
          the person behind the opinions
        </p>
      </div>

      {/* Bio Section */}
      <div className="card-y2k p-6 space-y-5">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 border-2 border-accent-primary">
            <img src="/penguin-logo.png" alt="Peak Music Reviews" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-2">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text-primary">
              Luca
            </h2>
            <p className="pixel-text text-sm text-text-muted">aka lu-cuh</p>
            <p className="text-text-secondary leading-relaxed">
              Music listener, opinion haver, data nerd. I&apos;ve been tracking my Spotify
              listening data for years because I genuinely wanted to know — do I actually
              listen to the stuff I say I like, or am I lying to myself?
            </p>
          </div>
        </div>

        <p className="text-text-secondary leading-relaxed">
          This blog exists because music review culture has a pretentiousness problem.
          You shouldn&apos;t need a degree in music theory to have a valid opinion about an album.
          Sometimes a song is great because the bass hits right. Sometimes you love an album
          because it reminds you of a specific drive at 2am. Those are real, valid reasons.
        </p>

        <p className="text-text-secondary leading-relaxed">
          Every review here comes with receipts — actual Spotify listening data showing
          how much I played something before writing about it. No reviewing an album after
          one listen and pretending I absorbed the whole thing.
        </p>

        {/* Quick stats from real data */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="text-center p-3 rounded-lg bg-bg-elevated">
            <p className="font-[family-name:var(--font-heading)] font-extrabold text-accent-primary text-lg">8,088</p>
            <p className="pixel-text text-xs text-text-muted uppercase">Hours listened</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-bg-elevated">
            <p className="font-[family-name:var(--font-heading)] font-extrabold text-accent-primary text-lg">152K</p>
            <p className="pixel-text text-xs text-text-muted uppercase">Total streams</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-bg-elevated">
            <p className="font-[family-name:var(--font-heading)] font-extrabold text-accent-primary text-lg">3,012</p>
            <p className="pixel-text text-xs text-text-muted uppercase">Artists</p>
          </div>
        </div>
      </div>

      {/* Philosophy */}
      <div className="space-y-4">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text-primary">
          The Philosophy
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: "Honest Over Polished",
              desc: "Real opinions, even when they're unpopular. No hedging to seem \"objective.\"",
              icon: "💬",
            },
            {
              title: "Data-Backed",
              desc: "Every review is tied to actual listening data. If I say I love it, the numbers prove it.",
              icon: "📊",
            },
            {
              title: "No Gatekeeping",
              desc: "Liking something for a \"dumb\" reason is just as valid as a technical breakdown.",
              icon: "🚪",
            },
            {
              title: "Anti-Pitchfork",
              desc: "No multi-paragraph preambles. No pretentious jargon. Just get to the point.",
              icon: "🎯",
            },
          ].map((item) => (
            <div key={item.title} className="card-y2k p-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.icon}</span>
                <h3 className="font-[family-name:var(--font-heading)] font-bold text-text-primary">
                  {item.title}
                </h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Streaming Profiles */}
      <div className="space-y-4">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text-primary">
          Find Me On
        </h2>
        <div className="flex flex-wrap gap-3">
          {streamingLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-y2k btn-y2k-outline"
            >
              <span>{link.emoji}</span>
              {link.name}
            </a>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="card-y2k p-6 text-center space-y-3">
        <p className="pixel-text text-accent-primary uppercase tracking-widest">
          Want to see what I&apos;m listening to right now?
        </p>
        <a href="/" className="btn-y2k btn-y2k-primary inline-flex">
          Go to Home
        </a>
      </div>
    </div>
  );
}
