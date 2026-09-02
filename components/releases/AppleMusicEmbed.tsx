/**
 * AppleMusicEmbed — Apple's official embed player, the Apple-side twin
 * of SpotifyEmbed. Shown INSTEAD of the Spotify player (never both —
 * Luca 2026-09-02) for members who picked Apple Music in Settings.
 *
 * Same legal footing as the Spotify one: the player is Apple's own
 * embed (embed.music.apple.com), streaming under their licenses — we
 * host nothing. Visitors get 30s previews; Apple Music subscribers
 * signed in to music.apple.com in the same browser play full tracks.
 *
 * src is built by lib/apple-music.ts from the cached, shape-checked id
 * (migration 036) — never from anything a user typed.
 * next.config.ts CSP frame-src allows embed.music.apple.com.
 */

import type { Release } from "@/lib/types/database";
import { appleMusicEmbedSrc, appleMusicUrl, type AppleMusicRef } from "@/lib/apple-music";

export default function AppleMusicEmbed({
  release,
  apple,
}: {
  release: Release;
  apple: AppleMusicRef;
}) {
  // Apple's song player is 175px; the album player shows its tracklist
  // at 450 (their documented sizes). Same xl: fill-the-column rule as
  // the Spotify card so the two are interchangeable in the grid.
  const height = apple.trackId ? 175 : 450;

  return (
    <div className="card-y2k p-4 sm:p-5 space-y-3 overflow-hidden xl:flex-1 xl:flex xl:flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">Preview</span>
        </div>
        <a
          href={appleMusicUrl(apple)}
          target="_blank"
          rel="noopener noreferrer"
          className="pixel-text text-[10px] text-text-muted hover:text-accent-primary uppercase tracking-widest transition-colors"
        >
          30s clips · via Apple Music ↗
        </a>
      </div>
      <iframe
        src={appleMusicEmbedSrc(apple)}
        width="100%"
        height={height}
        frameBorder="0"
        allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
        sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
        loading="lazy"
        title={`Apple Music preview of ${release.title}`}
        className="rounded-lg xl:flex-1 xl:min-h-0"
        style={{ background: "transparent", overflow: "hidden" }}
      />
    </div>
  );
}
