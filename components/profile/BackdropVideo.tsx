"use client";

/**
 * BackdropVideo — plays a prerendered loop behind a themed profile.
 *
 * Looks for /backdrops/<theme>.webm (or .mp4 as fallback source).
 * If the file doesn't exist the video errors, we hide it, and the
 * CSS-animated backdrop underneath carries the scene — so themes
 * upgrade to full 3D renders simply by dropping a loop file into
 * public/backdrops/. No config, no redeploy logic.
 *
 * Cheap on devices by design: prerendered video uses the hardware
 * decoder (unlike live WebGL), it's muted+inline so mobile autoplay
 * works, and we pause it entirely for prefers-reduced-motion users.
 */

import { useEffect, useRef, useState } from "react";

export default function BackdropVideo({ theme }: { theme: string }) {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Respect reduced motion: show the first frame, don't loop.
  useEffect(() => {
    if (
      videoRef.current &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      videoRef.current.pause();
    }
  }, []);

  if (failed) return null;

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
      >
        <source src={`/backdrops/${theme}.webm`} type="video/webm" />
        <source src={`/backdrops/${theme}.mp4`} type="video/mp4" />
      </video>
      {/* Readability scrim — keeps text crisp over bright render areas */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </>
  );
}
