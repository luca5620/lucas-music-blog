"use client";

import { useEffect, useState } from "react";

/**
 * NowPlaying — Live Spotify widget.
 * Polls /api/now-playing every 30 seconds.
 * Shows currently playing track with album art, or falls back to last played.
 *
 * When `accentColor` is provided, color-driven elements use inline styles
 * instead of the default Tailwind `accent-primary` classes — this lets the
 * widget adopt a profile owner's color when embedded on a profile page.
 */

interface TrackData {
  isPlaying: boolean;
  isConfigured: boolean;
  type?: string;
  title?: string;
  artist?: string;
  album?: string;
  albumArt?: string | null;
  trackUrl?: string;
  progress?: number;
  duration?: number;
  playedAt?: string;
  message?: string;
}

interface NowPlayingProps {
  accentColor?: string;
}

export default function NowPlaying({ accentColor }: NowPlayingProps = {}) {
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNowPlaying() {
      try {
        const res = await fetch("/api/now-playing");
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    /* Fetch immediately, then poll every 30 seconds */
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 30000);
    return () => clearInterval(interval);
  }, []);

  /* Loading state */
  if (loading) {
    return (
      <section className="card-y2k p-5 flex items-center gap-5">
        <div className="w-14 h-14 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0 border border-border-medium animate-pulse">
          <span className="text-2xl">🎧</span>
        </div>
        <div className="space-y-2 flex-1">
          <div className="h-3 w-20 bg-bg-elevated rounded animate-pulse" />
          <div className="h-4 w-48 bg-bg-elevated rounded animate-pulse" />
          <div className="h-3 w-32 bg-bg-elevated rounded animate-pulse" />
        </div>
      </section>
    );
  }

  /* Not configured or no data */
  if (!data || !data.isConfigured || !data.title) {
    return (
      <section className="card-y2k p-5 flex items-center gap-5">
        <div className="w-14 h-14 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0 border border-border-medium">
          <span className="text-2xl">🎧</span>
        </div>
        <div className="space-y-1 flex-1">
          <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            Now Playing
          </span>
          <p className="font-[family-name:var(--font-heading)] font-bold text-text-secondary">
            {data?.message || "Nothing playing right now"}
          </p>
        </div>
      </section>
    );
  }

  /* Calculate progress percentage if currently playing */
  const progressPercent =
    data.isPlaying && data.progress && data.duration
      ? (data.progress / data.duration) * 100
      : 0;

  /* Format "played at" time for recently played */
  const timeAgo = data.playedAt
    ? getTimeAgo(new Date(data.playedAt))
    : null;

  return (
    <a
      href={data.trackUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`card-y2k p-5 flex items-center gap-5 group cursor-pointer transition-all ${
        accentColor ? "" : "hover:border-accent-primary/30"
      }`}
    >
      {/* Album Art */}
      {data.albumArt ? (
        <img
          src={data.albumArt}
          alt={data.album}
          width={56}
          height={56}
          className={`w-14 h-14 rounded-lg shrink-0 object-cover border border-border-medium transition-colors ${
            accentColor ? "" : "group-hover:border-accent-primary/50"
          }`}
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0 border border-border-medium">
          <span className="text-2xl">🎧</span>
        </div>
      )}

      {/* Track Info */}
      <div className="space-y-1 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`pixel-text text-xs uppercase tracking-widest ${
              accentColor ? "" : "text-accent-primary"
            }`}
            style={accentColor ? { color: accentColor } : undefined}
          >
            {data.isPlaying ? "Now Playing" : "Last Played"}
          </span>
          {data.isPlaying && (
            <span className="flex gap-0.5 items-end h-3">
              {/* Animated equalizer bars */}
              <span
                className={`w-0.5 rounded-full animate-bounce ${
                  accentColor ? "" : "bg-accent-primary"
                }`}
                style={{
                  height: "8px",
                  animationDelay: "0ms",
                  animationDuration: "0.6s",
                  ...(accentColor ? { backgroundColor: accentColor } : {}),
                }}
              />
              <span
                className={`w-0.5 rounded-full animate-bounce ${
                  accentColor ? "" : "bg-accent-primary"
                }`}
                style={{
                  height: "12px",
                  animationDelay: "0.15s",
                  animationDuration: "0.6s",
                  ...(accentColor ? { backgroundColor: accentColor } : {}),
                }}
              />
              <span
                className={`w-0.5 rounded-full animate-bounce ${
                  accentColor ? "" : "bg-accent-primary"
                }`}
                style={{
                  height: "6px",
                  animationDelay: "0.3s",
                  animationDuration: "0.6s",
                  ...(accentColor ? { backgroundColor: accentColor } : {}),
                }}
              />
            </span>
          )}
        </div>
        <p
          className={`font-[family-name:var(--font-heading)] font-bold text-text-primary truncate transition-colors ${
            accentColor ? "" : "group-hover:text-accent-primary"
          }`}
        >
          {data.title}
        </p>
        <p className="text-sm text-text-secondary truncate">
          {data.artist}
          {timeAgo && !data.isPlaying && (
            <span className="text-text-muted"> · {timeAgo}</span>
          )}
        </p>
      </div>

      {/* Progress bar (only when actively playing) */}
      {data.isPlaying && (
        <div className="hidden md:block w-32 shrink-0">
          <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                accentColor ? "" : "bg-accent-primary"
              }`}
              style={{
                width: `${progressPercent}%`,
                ...(accentColor ? { backgroundColor: accentColor } : {}),
              }}
            />
          </div>
        </div>
      )}

      {/* Spotify link indicator */}
      <span className="text-xs text-text-muted shrink-0 hidden md:block">
        Spotify ↗
      </span>
    </a>
  );
}

/** Converts a date to a relative time string like "5 min ago" */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
