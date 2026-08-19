"use client";

import { useState, useRef } from "react";

interface ProfileSongPlayerProps {
  url: string;
  title: string;
  accentColor: string;
}

/** True when the URL is actual audio we can play in-page: a Spotify
    30s preview (p.scdn.co) or a direct audio file. Anything else
    (a Spotify track page, one of our release pages) renders as a
    link instead of a dead play button. */
function isPlayableAudio(url: string): boolean {
  return (
    url.includes("p.scdn.co") || /\.(mp3|m4a|ogg|wav|aac)(\?|$)/i.test(url)
  );
}

export default function ProfileSongPlayer({
  url,
  title,
  accentColor,
}: ProfileSongPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Non-audio target (catalog pick without a preview): song-as-link.
  if (!isPlayableAudio(url) && (url.startsWith("https://") || url.startsWith("/"))) {
    return (
      <a
        href={url}
        target={url.startsWith("/") ? undefined : "_blank"}
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:scale-[1.02]"
        style={{
          background: `${accentColor}10`,
          border: `1px solid ${accentColor}30`,
          color: accentColor,
        }}
      >
        <span className="text-lg">♪</span>
        <span className="text-left">
          <span className="font-[family-name:var(--font-vt323)] text-xs text-[#5a5a60] uppercase tracking-wider block">
            Profile Song
          </span>
          <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-bold block">
            {title} ↗
          </span>
        </span>
      </a>
    );
  }

  function togglePlay() {
    // Only play https or local audio — never other schemes from user data.
    if (!url.startsWith("https://") && !url.startsWith("/")) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.addEventListener("ended", () => setPlaying(false));
    }

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  }

  return (
    <button
      onClick={togglePlay}
      aria-label={playing ? `Pause profile song ${title}` : `Play profile song ${title}`}
      aria-pressed={playing}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:scale-[1.02]"
      style={{
        background: `${accentColor}10`,
        border: `1px solid ${accentColor}30`,
        color: accentColor,
      }}
    >
      {/* Play/Pause icon */}
      <span className="text-lg">{playing ? "\u23F8" : "\u25B6"}</span>

      {/* Song info */}
      <div className="text-left">
        <span className="font-[family-name:var(--font-vt323)] text-xs text-[#5a5a60] uppercase tracking-wider block">
          Profile Song
        </span>
        <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-bold block">
          {title}
        </span>
      </div>

      {/* Animated bars when playing \u2014 deterministic heights to avoid SSR hydration drift */}
      {playing && (
        <div className="flex items-end gap-[2px] h-4 ml-1">
          {[
            { height: 6, delay: 0 },
            { height: 12, delay: 0.2 },
            { height: 9, delay: 0.4 },
          ].map(({ height, delay }) => (
            <div
              key={delay}
              className="w-[3px] rounded-full animate-pulse"
              style={{
                background: accentColor,
                height: `${height}px`,
                animationDelay: `${delay}s`,
                animationDuration: "0.6s",
              }}
            />
          ))}
        </div>
      )}
    </button>
  );
}
