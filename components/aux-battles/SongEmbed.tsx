"use client";

/**
 * SongEmbed — the listening surface for one side of an aux battle.
 * Each source plays through its own official player (we host no
 * audio, Luca 2026-09-13: "listen through the api of either choice,
 * the youtube link being embedded"):
 *   spotify    → open.spotify.com/embed/track/<id>   (30s clips, full
 *                tracks when signed in to Spotify in this browser)
 *   soundcloud → w.soundcloud.com/player/?url=<permalink>
 *   youtube    → youtube-nocookie.com/embed/<id>
 * All three hosts are already in next.config.ts frame-src.
 */

import type { AuxSong } from "@/lib/types/database";

function src(song: AuxSong): string {
  switch (song.source) {
    case "spotify":
      return `https://open.spotify.com/embed/track/${song.embed_id}?theme=0`;
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${song.embed_id}?rel=0&modestbranding=1`;
    case "soundcloud": {
      const params = new URLSearchParams({
        url: song.embed_id,
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
  }
}

export default function SongEmbed({ song, title }: { song: AuxSong; title: string }) {
  // YouTube wants a 16:9 box; the audio players are short strips.
  if (song.source === "youtube") {
    return (
      <div className="w-full aspect-video rounded-lg overflow-hidden border border-border-subtle bg-black">
        <iframe
          src={src(song)}
          title={title}
          className="w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <iframe
      src={src(song)}
      title={title}
      width="100%"
      height={song.source === "spotify" ? 152 : 166}
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
      loading="lazy"
      className="rounded-lg block"
    />
  );
}

/** The service's own colour for a small SOURCE tag. */
export function sourceTag(source: AuxSong["source"]): { text: string; cls: string } {
  switch (source) {
    case "spotify":
      return { text: "SPOTIFY", cls: "text-osd-green border-osd-green/40" };
    case "soundcloud":
      return { text: "SOUNDCLOUD", cls: "text-osd-amber border-osd-amber/40" };
    case "youtube":
      return { text: "YOUTUBE", cls: "text-accent-rose border-accent-rose/40" };
  }
}
