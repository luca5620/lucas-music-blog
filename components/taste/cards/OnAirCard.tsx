"use client";

/**
 * OnAirCard — the broadcast card for a DEBATE.
 *
 * FAITHFUL PORT (for now) of the old ChannelSurf fullscreen debate
 * rendering: cover/mic poster, topic, "{A} vs {B} · {n} in the
 * arena". The WP7 fidelity pass (pulsing ON AIR status row, prompt
 * pull-quote, live VoteBar split, host chyron, big red JOIN LIVE
 * pill) replaces the internals next; the contract stays.
 *
 * The chrome already gives every debate its red color weather — the
 * pool is status=open only, so every debate card is ON AIR.
 */

import type { CardProps } from "./ChannelChrome";
import ChannelChrome, { RailOpen, hrefOf, safeImage } from "./ChannelChrome";

export default function OnAirCard({ item, near }: CardProps<"debate">) {
  const cover = safeImage(item.cover_image);

  return (
    <ChannelChrome
      item={item}
      near={near}
      rail={
        // Debates have no likes and no comment sheet — the room IS
        // the conversation; the arrow is the way in.
        <RailOpen href={hrefOf(item)} label="debate" />
      }
    >
      <span className="poster shrink-0 relative w-40 sm:w-48">
        {cover && near ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={`${item.title} cover`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-5xl">
            🎙️
          </span>
        )}
      </span>

      <span className="block max-w-md space-y-1">
        <span className="block text-lg sm:text-xl font-bold text-text-primary font-[family-name:var(--font-heading)] leading-snug">
          {item.title}
        </span>
        <span className="block text-sm text-text-secondary">
          {item.side_a_label} vs {item.side_b_label} · {item.activity} in the
          arena
        </span>
        {item.reason && (
          <span className="block text-xs text-accent-primary/80 pt-0.5">
            ◈ {item.reason}
          </span>
        )}
      </span>
    </ChannelChrome>
  );
}
