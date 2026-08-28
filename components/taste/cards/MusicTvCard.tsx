"use client";

/**
 * MusicTvCard — the broadcast card for a POST (WP7 fidelity pass;
 * replaces the faithful port of the old ChannelSurf rendering).
 *
 * The full program renderer — VIDEO-DOMINANT, like the channel it's
 * named after:
 *  - Format chips: "MUSIC TV" (chrome) + "▶ YOUTUBE"/"▶ TIKTOK".
 *  - The video poster takes the FULL column width with a big play
 *    triangle inside an accent ring — the picture is the show, the
 *    words are the caption. TikTok posters (no thumbnail service)
 *    use the tied release's cover instead of the old 📺 emoji.
 *  - CHYRON: avatar + "PRESENTED BY @user" + role chip — the poster
 *    is the host of this segment.
 *  - FEATURING caption: "{release title} — {artist}" linking the
 *    tied release (fields widened in WP1); catalog scent without
 *    leaving the broadcast.
 *  - Rail: like (count) + the open arrow labeled "FULL POST". NO
 *    comments affordance — posts have no comments table; never fake
 *    an input that goes nowhere.
 *
 * MEDIA RULES (settled-index windowing from the frame):
 *  - Nothing mounts until the viewer taps ▶ (taps only land on the
 *    active card — it's the only one on screen).
 *  - YOUTUBE keep-alive: when the card stops being `active` the
 *    player is PAUSED via the iframe postMessage API but stays
 *    MOUNTED while still `near` (±1) — swipe back and it resumes.
 *    Beyond ±1 it unmounts, killing audio for good:
 *    audio-beyond-±1 is the invariant.
 *  - TIKTOK always unmounts the moment the card stops being
 *    active — its embed has no reliable pause API.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CardProps } from "./ChannelChrome";
import ChannelChrome, {
  Chyron,
  RailLike,
  RailOpen,
  RoleChip,
  hrefOf,
  safeImage,
  timeAgo,
} from "./ChannelChrome";
import { smallCover } from "@/lib/images";
import { hapticTap } from "@/lib/native";

/**
 * Fallback flag: pause-via-postMessage is believed reliable on
 * youtube-nocookie embeds with enablejsapi=1, but it has NOT been
 * eyeballed on Luca's iPhone yet. If pause proves flaky on device,
 * flip this to false and YouTube falls back to today's behavior —
 * unmount the instant the card stops being active (loses resume
 * position, guarantees silence).
 */
const YT_PAUSE_KEEPALIVE = true;

export default function MusicTvCard({ item, active, near }: CardProps<"post">) {
  // Posts without a tied release fall back to the video's thumbnail
  // (YouTube serves one per id; TikTok doesn't, so those lean on the
  // tied release's cover — the 📺 emoji is the last resort).
  const cover =
    safeImage(item.cover_image) ??
    (item.video_kind === "youtube" && item.video_id
      ? `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`
      : null);
  const hasVideo = !!item.video_kind && !!item.video_id;
  const hasRelease = !!item.release_slug && !!item.release_title;

  const [playing, setPlaying] = useState(false);
  const ytRef = useRef<HTMLIFrameElement>(null);

  // Leaving the ±1 window unmounts EVERY player (audio hygiene's
  // hard boundary). Guarded RENDER-PHASE adjustments, not effects:
  // the unmount must land in the same paint as the window change,
  // and the guards make each fire at most once per transition.
  if (!near && playing) setPlaying(false);
  // Snapping away from the card: TikTok unmounts immediately (no
  // pause API) — YouTube too when the keep-alive flag is off.
  if (
    playing &&
    near &&
    !active &&
    (item.video_kind === "tiktok" || !YT_PAUSE_KEEPALIVE)
  ) {
    setPlaying(false);
  }

  // Snapping away from a mounted YouTube player: PAUSE in place via
  // postMessage (an external system — this one is a real effect) and
  // keep the iframe while near, so swiping back resumes position.
  useEffect(() => {
    if (active || !playing) return;
    if (item.video_kind !== "youtube" || !YT_PAUSE_KEEPALIVE) return;
    // enablejsapi=1 in the embed URL is what makes this listener
    // exist on YouTube's side.
    ytRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "pauseVideo", args: "" }),
      "*"
    );
  }, [active, playing, item.video_kind]);

  return (
    <ChannelChrome
      item={item}
      near={near}
      chipExtra={
        item.video_kind && (
          <span className="label-xbox">
            ▶ {item.video_kind === "youtube" ? "YOUTUBE" : "TIKTOK"}
          </span>
        )
      }
      rail={
        <>
          <RailLike
            kind="post"
            id={item.id}
            initialCount={item.like_count}
            initialLiked={item.viewer_has_liked}
          />
          {/* No comments affordance — posts have no comments table;
              never fake it. The labeled arrow is the way to the rest
              of the post. */}
          <RailOpen href={hrefOf(item)} label="post" caption="FULL POST" />
        </>
      }
    >
      {/* CHYRON — the presenter of this segment */}
      <Chyron
        avatarUrl={item.avatar_url}
        letter={(item.username || "U")[0]}
        right={
          <span className="osd-text text-[10px] whitespace-nowrap">
            {timeAgo(item.created_at)}
          </span>
        }
      >
        <span className="pixel-text text-[9px] uppercase tracking-widest text-text-muted">
          PRESENTED BY
        </span>
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-bold text-text-primary truncate">
            @{item.username}
          </span>
          <RoleChip role={item.role} />
        </span>
      </Chyron>

      {/* THE PICTURE — video-dominant: mounted player, else a
          full-column-width poster with the big accent-ringed ▶.
          Players only exist while `near` (see the guards above). */}
      {hasVideo && playing && near ? (
        item.video_kind === "youtube" ? (
          <span className="block w-full max-w-md aspect-video rounded-lg overflow-hidden border border-border-subtle bg-black shrink-0">
            <iframe
              ref={ytRef}
              src={`https://www.youtube-nocookie.com/embed/${item.video_id}?autoplay=1&playsinline=1&enablejsapi=1`}
              title={item.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="w-full h-full"
            />
          </span>
        ) : (
          <span className="block w-full max-w-[280px] flex-shrink min-h-0 rounded-lg overflow-hidden border border-border-subtle bg-black">
            <iframe
              src={`https://www.tiktok.com/embed/v2/${item.video_id}`}
              title={item.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="w-full h-[420px] max-h-full"
            />
          </span>
        )
      ) : (
        <span className="block w-full max-w-md aspect-video rounded-lg overflow-hidden border border-border-subtle bg-black relative shrink-0">
          {cover && near ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={smallCover(cover)}
              alt={`${item.title} cover`}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-5xl">
              📺
            </span>
          )}
          {/* Tap-to-play: the big ▶ in an accent RING (static border,
              not a shadow — rings are the house press language). */}
          {hasVideo && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setPlaying(true);
              }}
              aria-label="Play video"
              className="absolute inset-0 flex items-center justify-center bg-black/35 hover:bg-black/20 transition-colors"
            >
              <span className="w-16 h-16 rounded-full bg-black/70 border-2 border-accent-primary ring-2 ring-accent-primary/40 flex items-center justify-center text-2xl text-white pl-1">
                ▶
              </span>
            </button>
          )}
        </span>
      )}

      {/* FEATURING — the tied release, linked (WP1 widened fields).
          The catalog is one tap away without killing the broadcast. */}
      {hasRelease && (
        <Link
          href={`/releases/${item.release_slug}`}
          onClick={() => hapticTap()}
          className="osd-text text-[10px] max-w-md truncate hover:text-accent-glow transition-colors shrink-0"
        >
          FEATURING: {item.release_title}
          {item.release_artist ? ` — ${item.release_artist}` : ""}
        </Link>
      )}

      <span className="block max-w-md space-y-1">
        <span className="block text-lg sm:text-xl font-bold text-text-primary font-[family-name:var(--font-heading)] leading-snug">
          {item.title}
        </span>
        {item.reason && (
          <span className="block text-xs text-accent-primary/80 pt-0.5">
            ◈ {item.reason}
          </span>
        )}
      </span>

      {/* The post's words — long reads scroll inside their own box
          (contained so the read never flips the channel). */}
      {item.body && (
        <span
          className={`block max-w-md text-sm text-text-secondary leading-relaxed whitespace-pre-line ${
            item.body.length > 280
              ? "w-full flex-shrink min-h-0 overflow-y-auto overscroll-contain touch-pan-y text-left px-1 [scrollbar-width:thin]"
              : "text-center"
          }`}
        >
          {item.body}
        </span>
      )}
    </ChannelChrome>
  );
}
