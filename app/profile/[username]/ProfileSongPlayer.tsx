"use client";

import { useState, useRef } from "react";

interface ProfileSongPlayerProps {
  url: string;
  title: string;
  accentColor: string;
}

export default function ProfileSongPlayer({
  url,
  title,
  accentColor,
}: ProfileSongPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function togglePlay() {
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

      {/* Animated bars when playing */}
      {playing && (
        <div className="flex items-end gap-[2px] h-4 ml-1">
          {[0, 0.2, 0.4].map((delay) => (
            <div
              key={delay}
              className="w-[3px] rounded-full animate-pulse"
              style={{
                background: accentColor,
                height: `${Math.random() * 12 + 4}px`,
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
