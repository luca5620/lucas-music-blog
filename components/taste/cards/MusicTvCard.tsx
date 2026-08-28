"use client";

/**
 * MusicTvCard — the broadcast card for a POST (usually a YouTube or
 * TikTok share).
 *
 * FAITHFUL PORT (for now) of the old ChannelSurf fullscreen post
 * rendering: author line, tap-to-play video poster, title, the
 * post's words. The WP7 fidelity pass (video-dominant layout,
 * PRESENTED BY chyron, FEATURING caption) replaces the internals
 * next; the contract stays.
 *
 * MEDIA RULES (the new part — replaces the old IntersectionObserver
 * with the frame's settled-index windowing):
 *  - Nothing mounts until the viewer taps ▶ (and taps only land on
 *    the active card — it's the only one on screen).
 *  - YOUTUBE keep-alive: when the card stops being `active` (viewer
 *    snapped away) the player is PAUSED via the iframe postMessage
 *    API but stays MOUNTED while still `near` (±1) — swipe back and
 *    it resumes where it was. Beyond ±1 it unmounts, killing audio
 *    for good: audio-beyond-±1 is the invariant.
 *  - TIKTOK always unmounts the moment the card stops being active —
 *    its embed has no reliable pause API.
 */

import { useEffect, useRef, useState } from "react";
import type { CardProps } from "./ChannelChrome";
import ChannelChrome, {
  RailLike,
  RailOpen,
  hrefOf,
  safeImage,
} from "./ChannelChrome";
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
  // (YouTube serves one per id; TikTok doesn't, so those show the icon).
  const cover =
    safeImage(item.cover_image) ??
    (item.video_kind === "youtube" && item.video_id
      ? `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`
      : null);
  const hasVideo = !!item.video_kind && !!item.video_id;

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
      rail={
        <>
          <RailLike
            kind="post"
            id={item.id}
            initialCount={item.like_count}
            initialLiked={item.viewer_has_liked}
          />
          {/* No comments affordance — posts have no comments table;
              never fake it. */}
          <RailOpen href={hrefOf(item)} label="post" />
        </>
      }
    >
      {/* Posts lead with the person too — their transmission */}
      <span className="flex items-center gap-2.5">
        {safeImage(item.avatar_url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeImage(item.avatar_url)!}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-8 h-8 rounded-full object-cover border border-white/10"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-xs font-bold text-accent-primary uppercase">
            {(item.username || "U")[0]}
          </span>
        )}
        <span className="text-sm text-text-secondary">
          <span className="font-bold text-text-primary">
            {item.display_name || item.username}
          </span>{" "}
          posted
          {item.video_kind && (
            <span className="text-text-muted">
              {" "}
              · ▶ {item.video_kind === "youtube" ? "YouTube" : "TikTok"}
            </span>
          )}
        </span>
      </span>

      {/* The picture slot: mounted player > tappable poster. Players
          only exist while `near` (see the effects above). */}
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
        <span className="poster shrink-0 relative w-28 sm:w-32">
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
              📺
            </span>
          )}
          {/* Tap-to-play: big ▶ over the poster */}
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
              <span className="w-14 h-14 rounded-full bg-black/70 border border-white/30 flex items-center justify-center text-2xl text-white pl-1">
                ▶
              </span>
            </button>
          )}
        </span>
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
