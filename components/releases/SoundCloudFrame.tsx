"use client";

/**
 * SoundCloudFrame — the SoundCloud widget iframe plus the volume
 * slider, as a client island inside the (server-rendered)
 * SoundCloudEmbed card. The iframe needs a ref for the Widget API to
 * take a volume command, which a server component can't hold.
 */

import { useRef } from "react";
import { soundcloudEmbedSrc } from "@/lib/soundcloud-embed";
import { useEmbedVolume } from "@/components/ui/useEmbedVolume";
import VolumeSlider from "@/components/ui/VolumeSlider";

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
      <VolumeSlider className="max-w-xs" />
    </div>
  );
}
