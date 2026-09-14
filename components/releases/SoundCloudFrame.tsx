"use client";

/**
 * SoundCloudFrame — the SoundCloud widget iframe as a client island
 * inside the (server-rendered) SoundCloudEmbed card. The Widget API
 * needs a ref to the iframe to take a volume command, which a server
 * component cannot hold. The control itself is the site-wide
 * VolumeDock, which this frame switches on just by being mounted.
 */

import { useRef } from "react";
import { soundcloudEmbedSrc } from "@/lib/soundcloud-embed";
import { useEmbedVolume } from "@/components/ui/useEmbedVolume";

export default function SoundCloudFrame({
  permalink,
  height,
  title,
  className = "",
}: {
  permalink: string;
  height: number;
  title: string;
  className?: string;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  useEmbedVolume(frameRef, "soundcloud");

  return (
    <div className={`space-y-2 ${className}`}>
      <iframe
        ref={frameRef}
        src={soundcloudEmbedSrc(permalink)}
        width="100%"
        height={height}
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media"
        loading="lazy"
        title={title}
        className="rounded-lg block"
      />
    </div>
  );
}
