/**
 * TopTracksList — Vertical list of top tracks with rank, cover, name + artist,
 * and stream counts.
 * Server component.
 */

import type { TopTrackRow } from "@/data/analytics/lucas";

interface Props {
  tracks: TopTrackRow[];
  accentColor: string;
}

export default function TopTracksList({ tracks, accentColor }: Props) {
  return (
    <div className="panel-xbox p-5 space-y-4 relative">
      <div className="flex items-center gap-3">
        <span className="label-xbox">Top Tracks</span>
        <span className="text-xs text-text-muted">Most played</span>
      </div>
      <div className="space-y-2">
        {tracks.map((track, i) => (
          <a
            key={`${track.name}-${i}`}
            href={`https://open.spotify.com/track/${track.spotifyId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 rounded-lg transition-colors"
          >
            <span className="pixel-text text-lg text-text-muted w-6 text-right">
              {i + 1}
            </span>
            <div className="w-10 h-10 rounded overflow-hidden bg-bg-elevated shrink-0">
              <img
                src={track.image}
                alt={track.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-[family-name:var(--font-heading)] font-semibold text-text-primary text-sm truncate">
                {track.name}
              </p>
              <p className="text-xs text-text-secondary truncate">
                {track.artist}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p
                className="text-sm font-semibold"
                style={{ color: accentColor }}
              >
                {track.streams.toLocaleString()} streams
              </p>
              <p className="text-xs text-text-muted">{track.hours}h</p>
            </div>
          </a>
        ))}
      </div>
      <div className="scan-bar" />
    </div>
  );
}
