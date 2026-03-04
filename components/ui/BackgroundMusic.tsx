"use client";

import { useState, useRef, useEffect } from "react";

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio("/sounds/bg-music.mp3");
    audio.loop = true;
    audio.volume = 0.08;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  return (
    <button
      onClick={toggle}
      className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:border-accent-primary/50 transition-all overflow-hidden"
      title={playing ? "Mute music" : "Play music"}
    >
      <span className="relative w-full h-full flex items-center justify-center">
        <span className="text-sm">♫</span>
        {!playing && <span className="absolute inset-0 flex items-center justify-center"><span className="block w-[90%] h-[1.5px] bg-current rotate-[-45deg]" /></span>}
      </span>
    </button>
  );
}
