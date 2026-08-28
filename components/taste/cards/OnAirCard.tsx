"use client";

/**
 * OnAirCard — the broadcast card for a DEBATE (WP7 fidelity pass;
 * replaces the faithful port of the old ChannelSurf rendering).
 *
 * The pool is status=open only, so every debate card is LIVE — the
 * whole card leans into that:
 *  - RED chrome: ChannelChrome already hard-overrides the color
 *    weather to red for debates; this card adds the red status row —
 *    pulsing `.glow-orb-red` + "ON AIR" (the orb parks as a static
 *    red dot under the app's idle-thermal state) with "{n} TAKES"
 *    right-aligned (message_count — votes don't count as takes).
 *  - `.crt-title` topic + the debate's PROMPT as a two-line
 *    pull-quote — the framing question is the hook.
 *  - The full VoteBar A/B gradient split fed by the corrected
 *    per-side tallies (WP1), with the two side labels as opposing
 *    pills above it (accent vs rose, same colors the bar uses).
 *  - HOST chyron: whoever opened the debate.
 *  - Tied-release cover as a modest art slot (the topic's subject,
 *    not the star — the argument is the star).
 *  - Rail: NO like (debates have none) — one big red JOIN LIVE pill
 *    linking the debate room is the card's entire CTA (voting stays
 *    in the room; no new write APIs).
 */

import Link from "next/link";
import type { CardProps } from "./ChannelChrome";
import ChannelChrome, { Chyron, hrefOf, safeImage } from "./ChannelChrome";
import VoteBar from "@/components/debates/VoteBar";
import { smallCover } from "@/lib/images";
import { hapticTap } from "@/lib/native";

export default function OnAirCard({ item, near }: CardProps<"debate">) {
  const cover = safeImage(item.cover_image);

  return (
    <ChannelChrome
      item={item}
      near={near}
      rail={
        // The single CTA — a big red pill, not an icon: joining a
        // live argument deserves a door, not a doorknob. Press
        // feedback is the global accent ring (never shadows).
        <Link
          href={hrefOf(item)}
          onClick={() => hapticTap()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border-2 border-[#ff3344] bg-[#ff3344]/15 text-[#ff5566] hover:bg-[#ff3344]/25 transition-colors text-xs font-bold uppercase tracking-wider font-[family-name:var(--font-heading)] whitespace-nowrap"
        >
          JOIN LIVE
        </Link>
      }
    >
      {/* STATUS ROW — the tally light. Red, always: open debates are
          the only ones that air. */}
      <span className="flex items-center justify-between gap-3 w-full max-w-md shrink-0">
        <span className="flex items-center gap-2">
          <span className="glow-orb-red" aria-hidden="true" />
          <span className="osd-text text-[11px] !text-[#ff5566] [text-shadow:0_0_6px_rgba(255,51,68,0.5)]">
            ON AIR
          </span>
        </span>
        <span className="osd-text text-[10px]">
          {item.message_count} TAKES
        </span>
      </span>

      {/* The topic */}
      <span className="crt-title block max-w-md text-xl sm:text-2xl leading-snug">
        {item.title}
      </span>

      {/* The PROMPT — the framing question as a pull-quote. Two-line
          clamp: a teaser, not the whole argument. */}
      {item.prompt && (
        <span className="block max-w-md text-base italic text-text-secondary leading-relaxed line-clamp-2 border-l-2 border-[#ff3344]/60 pl-3 text-left">
          “{item.prompt}”
        </span>
      )}

      {/* Modest art slot — the record under debate */}
      {cover && (
        <span className="poster shrink-0 relative w-24 sm:w-28">
          {near ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={smallCover(cover)}
              alt={`${item.title} cover`}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-4xl">
              🎙️
            </span>
          )}
        </span>
      )}

      {/* THE SPLIT — opposing pills (the two corners) over the live
          VoteBar, fed by the per-side tallies WP1 corrected. */}
      <span className="block w-full max-w-md space-y-2 shrink-0">
        <span className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-accent-primary/50 bg-accent-primary/10 text-accent-primary text-xs font-bold uppercase tracking-wide font-[family-name:var(--font-heading)] max-w-[48%]">
            <span className="truncate">{item.side_a_label}</span>
            <span className="pixel-text tabular-nums shrink-0">
              {item.side_a_count}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-accent-rose/50 bg-accent-rose/10 text-accent-rose text-xs font-bold uppercase tracking-wide font-[family-name:var(--font-heading)] max-w-[48%]">
            <span className="truncate">{item.side_b_label}</span>
            <span className="pixel-text tabular-nums shrink-0">
              {item.side_b_count}
            </span>
          </span>
        </span>
        {/* compact drops VoteBar's own label row (the pills above do
            that job) and keeps the total-votes line under the bar. */}
        <VoteBar
          a={item.side_a_count}
          b={item.side_b_count}
          sideALabel={item.side_a_label}
          sideBLabel={item.side_b_label}
          compact
        />
      </span>

      {item.reason && (
        <span className="block max-w-md text-xs text-accent-primary/80">
          ◈ {item.reason}
        </span>
      )}

      {/* HOST chyron — whoever put this argument on the air */}
      {item.creator_username && (
        <Chyron
          avatarUrl={item.creator_avatar_url}
          letter={item.creator_username[0]}
        >
          <span className="pixel-text text-[9px] uppercase tracking-widest text-text-muted">
            HOSTED BY
          </span>
          <span className="text-sm font-bold text-text-primary truncate">
            @{item.creator_username}
          </span>
        </Chyron>
      )}
    </ChannelChrome>
  );
}
