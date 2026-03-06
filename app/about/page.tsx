/**
 * About Page — Who Luca is, what this site is, the philosophy behind it.
 * Real profile links to Spotify, SoundCloud, and stats.fm.
 */

import FAQSchema from "@/components/seo/FAQSchema";
import { aboutFAQs } from "@/lib/faq-data";
import { BreadcrumbSchema, ProfilePageSchema } from "@/app/schema";

export const metadata = {
  title: "About",
  description:
    "Meet Luca — the music listener, opinion haver, and data nerd behind Peak Music Reviews. Honest reviews backed by real Spotify data.",
  alternates: {
    canonical: "https://peakmusicreviews.com/about",
  },
};

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
      {/* JSON-LD Structured Data */}
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "About", href: "/about" },
        ]}
      />
      <ProfilePageSchema />
      <FAQSchema items={aboutFAQs} />

      {/* Header */}
      <div className="space-y-3">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold text-accent-rose">
          About
        </h1>
        <p className="pixel-text text-lg text-accent-primary">
          the person behind the opinions
        </p>
      </div>

      {/* Bio Section */}
      <div className="card-y2k p-4 sm:p-6 space-y-5">
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0 border-2 border-accent-primary">
            <img src="/penguin-logo.png" alt="Peak Music Reviews" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-2 min-w-0">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text-primary">
              Luca
            </h2>
            <p className="pixel-text text-sm text-text-muted">aka lu-cuh</p>
            <p className="pixel-text text-sm text-accent-primary mt-2">
              Work in Progress
            </p>
          </div>
        </div>

        {/* Quick stats from real data */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="text-center p-3 rounded-lg bg-bg-elevated">
            <p className="font-[family-name:var(--font-heading)] font-extrabold text-accent-primary text-lg">8,688</p>
            <p className="pixel-text text-xs text-text-muted uppercase">Hours listened</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-bg-elevated">
            <p className="font-[family-name:var(--font-heading)] font-extrabold text-accent-primary text-lg">169K</p>
            <p className="pixel-text text-xs text-text-muted uppercase">Total streams</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-bg-elevated">
            <p className="font-[family-name:var(--font-heading)] font-extrabold text-accent-primary text-lg">4,186</p>
            <p className="pixel-text text-xs text-text-muted uppercase">Artists</p>
          </div>
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

    </div>
  );
}
