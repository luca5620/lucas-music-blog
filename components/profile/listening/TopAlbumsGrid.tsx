/**
 * TopAlbumsGrid — Responsive grid of top album tiles.
 * Server component.
 */

import type { TopAlbumRow } from "@/data/analytics/lucas";

interface Props {
  albums: TopAlbumRow[];
  accentColor: string;
}

export default function TopAlbumsGrid({ albums, accentColor }: Props) {
  return (
    <div className="panel-xbox p-5 space-y-4 relative">
      <div className="flex items-center gap-3">
        <span className="label-xbox">Top Albums</span>
        <span className="text-xs text-text-muted">Hours listened</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {albums.map((album, i) => (
          <a
            key={`${album.name}-${i}`}
            href={`https://open.spotify.com/album/${album.spotifyId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center space-y-2 hover:opacity-80 transition-opacity"
          >
            <div className="aspect-square rounded-lg bg-bg-elevated overflow-hidden border border-border-subtle">
              <img
                src={album.image}
                alt={album.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p
                className="pixel-text text-xs"
                style={{ color: accentColor }}
              >
                #{i + 1}
              </p>
              <p className="font-[family-name:var(--font-heading)] font-semibold text-text-primary text-xs leading-tight">
                {album.name}
              </p>
              <p className="text-xs text-text-secondary">{album.artist}</p>
              <p className="text-xs text-text-muted">{album.hours}h</p>
            </div>
          </a>
        ))}
      </div>
      <div className="scan-bar" />
    </div>
  );
}
