/**
 * The SoundCloud widget URL — a pure string builder, kept OUT of
 * lib/soundcloud.ts so client components can import it.
 *
 * lib/soundcloud.ts reaches for the Supabase server client (it caches
 * resolved permalinks on the release row), and anything a client
 * component imports drags its whole module graph into the browser
 * bundle — which fails the build the moment `next/headers` shows up
 * there. This file has no imports at all, so both sides can use it.
 */

/** The public embed player src for a track or set permalink. */
export function soundcloudEmbedSrc(permalink: string): string {
  const params = new URLSearchParams({
    url: permalink,
    color: "#1e90ff",
    auto_play: "false",
    hide_related: "true",
    show_comments: "false",
    show_user: "true",
    show_reposts: "false",
    show_teaser: "false",
    visual: "false",
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}
