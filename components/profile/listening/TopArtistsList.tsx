/**
 * TopArtistsList — Vertical list of top artists with rank, image, name,
 * streams, hours, and an inline progress bar driven by hours.
 * Server component.
 */

import type { TopArtistRow } from "@/data/analytics/lucas";

interface Props {
  artists: TopArtistRow[];
  accentColor: string;
}

export default function TopArtistsList({ artists, accentColor }: Props) {
  const maxHours = artists[0]?.hours ?? 1;

  return (
    <div className="panel-xbox p-5 space-y-4 relative">
      <div className="flex items-center gap-3">
        <span className="label-xbox">Top Artists</span>
        <span className="text-xs text-text-muted">All time</span>
      </div>
      <div className="space-y-3">
        {artists.map((artist, i) => (
          <a
            key={artist.name}
            href={`https://open.spotify.com/artist/${artist.spotifyId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 hover:bg-bg-elevated/50 rounded-lg p-1 -m-1 transition-colors"
          >
            <span className="pixel-text text-lg text-text-muted w-6 text-right">
              {i + 1}
            </span>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-bg-elevated shrink-0">
              <img
                src={artist.image}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-[family-name:var(--font-heading)] font-semibold text-text-primary text-sm truncate">
                {artist.name}
              </p>
              <div className="h-1.5 bg-bg-elevated rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(artist.hours / maxHours) * 100}%`,
                    backgroundColor: accentColor,
                  }}
                />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-text-primary">
                {artist.streams.toLocaleString()} streams
              </p>
              <p className="text-xs text-text-muted">
                {artist.hours.toLocaleString()}h
              </p>
            </div>
          </a>
        ))}
      </div>
      <div className="scan-bar" />
    </div>
  );
}
