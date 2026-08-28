"use client";

/**
 * TasteGuide — TONIGHT'S PROGRAMMING, the station lobby's EPG
 * (electronic program guide, like a cable box channel listing).
 *
 * The /your-taste page is now a TV station lobby: the masthead up top
 * is server-rendered (page.tsx), and THIS component is everything
 * interactive below it —
 *
 *  1. The EPG panel: one row per tuned pick, styled like a cable
 *     guide — CH number, cover art, a format chip (CRITIC SEGMENT /
 *     MUSIC TV / ON AIR / PREMIERE), title, and the reason chip when
 *     the algorithm has one. Rows are BUTTONS, not Links: tapping a
 *     row enters the fullscreen broadcast AT that channel (random
 *     access). The old pager rows were links that navigated away —
 *     that tap-steals-you-off-the-page bug is what this fixes.
 *  2. The GO LIVE button: starts the broadcast at CH 01, or resumes
 *     at the channel you left off on when this session has one saved.
 *
 * Watched-row dimming + resume both read sessionStorage
 * `pmr_taste_session` ({ itemKeys, index }) — the fullscreen frame's
 * persistence contract. ChannelFrame writes it on every settled
 * snap, so the lobby remembers how far you got even if the tab dies
 * mid-broadcast. sessionStorage dies with the tab — a fresh visit is
 * a fresh broadcast, by design.
 *
 * Fullscreen is the rebuilt ChannelFrame overlay (CH OSD, static
 * bursts, drag-to-exit, windowed media), mounted with initialIndex
 * behind this component's enterAt() contract.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TunedItem } from "@/lib/taste";
import ChannelFrame, { tunedItemKey } from "@/components/taste/ChannelFrame";
import { thumbCover } from "@/lib/images";
import { hapticImpact } from "@/lib/native";

/**
 * sessionStorage key shared with the fullscreen frame (which owns the
 * WRITES — see ChannelFrame's persistSession) — the saved shape is
 * { itemKeys: string[], index: number }. itemKeys is the FULL key
 * sequence of the mix that was playing, so a stale session (day
 * rotation, retune, different mix) is detected by comparison and
 * cleared instead of resuming into the wrong channel. Fail-soft
 * everywhere: storage errors just mean no resume.
 */
const SESSION_KEY = "pmr_taste_session";

/** Only https:// or local /path images (stored-XSS defense — same
    guard the pager cards use). */
function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

/** "01"-style channel number — EPGs zero-pad, so we do too. */
function chNum(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** The broadcast-format chip per content type — TV language, not
    database language (the broadcast framing). */
const FORMAT_LABEL: Record<TunedItem["type"], string> = {
  review: "CRITIC SEGMENT",
  post: "MUSIC TV",
  debate: "ON AIR",
  release: "PREMIERE",
};

/** The row's second line: who/what the channel is about. */
function secondaryOf(item: TunedItem): string {
  switch (item.type) {
    case "review":
      return item.artist;
    case "post":
      return `@${item.username}`;
    case "debate":
      return `${item.side_a_label} vs ${item.side_b_label}`;
    case "release":
      return item.artist;
  }
}

/** 64px art for the row — thumbCover() swaps Spotify covers to their
    64×64 file (never ship 640px into a thumbnail slot). Posts with no
    tied release fall back to the YouTube thumbnail, exactly like the
    fullscreen cards; TikTok has no thumbnail URL, so those get the
    emoji fallback. */
function coverOf(item: TunedItem): string | null {
  const cover = safeImage(item.cover_image);
  if (cover) return thumbCover(cover);
  if (item.type === "post" && item.video_kind === "youtube" && item.video_id) {
    return `https://i.ytimg.com/vi/${item.video_id}/default.jpg`;
  }
  return null;
}

export default function TasteGuide({
  items,
  channelName,
}: {
  items: TunedItem[];
  /** "THE {NAME} CHANNEL" — for the frame's NOW WATCHING splash and
      the sign-off card (server-resolved in page.tsx). */
  channelName: string;
}) {
  // Key sequence of the served mix — computed once; every resume /
  // watched decision compares against it. tunedItemKey is the ONE
  // client-side copy of the key format (see ChannelFrame).
  const keys = useMemo(() => items.map(tunedItemKey), [items]);

  // Which channel the viewer is LIVE on (null = lobby). Mounting the
  // fullscreen overlay is gated on this, so nothing heavy exists
  // until the viewer opts in — no auto-enter, deliberately (App
  // Review is pending; the lobby is the safe landing).
  const [liveAt, setLiveAt] = useState<number | null>(null);
  // Channels already watched this session (dimmed rows + resume).
  const [watched, setWatched] = useState<Set<string>>(() => new Set());
  const [resumeIndex, setResumeIndex] = useState<number | null>(null);

  /* On lobby mount: restore the session, but ONLY if it belongs to
     this exact mix. Day rotation / retune / seen-downrank all change
     the key sequence — a mismatched session is cleared, never
     half-applied. Runs in an effect because sessionStorage doesn't
     exist during server render. */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { itemKeys?: unknown; index?: unknown };
      const stored = Array.isArray(parsed.itemKeys)
        ? (parsed.itemKeys as string[])
        : null;
      const idx = typeof parsed.index === "number" ? parsed.index : null;
      const matches =
        stored !== null &&
        idx !== null &&
        idx >= 0 &&
        idx < keys.length &&
        stored.length === keys.length &&
        stored.every((k, i) => k === keys[i]);
      if (matches) {
        setResumeIndex(idx);
        // Linear pager: everything up to where you got is "watched".
        setWatched(new Set(keys.slice(0, idx + 1)));
      } else {
        sessionStorage.removeItem(SESSION_KEY); // stale mix — fail-soft
      }
    } catch {
      /* storage blocked / corrupt JSON — the lobby just starts fresh */
    }
  }, [keys]);

  /** Enter the broadcast at a channel. MEDIUM haptic — entering
      fullscreen is a deliberate act in the vocabulary (lib/native). */
  const enterAt = useCallback((index: number) => {
    hapticImpact("MEDIUM");
    setLiveAt(index);
  }, []);

  /** Fullscreen closed at `lastIndex` — update the lobby's
      watched/resume state in place. The sessionStorage write is NOT
      here anymore: ChannelFrame persists on every settled snap, so
      the session is already saved (and survives even a killed tab
      process mid-broadcast). */
  const handleExit = useCallback(
    (lastIndex: number) => {
      setLiveAt(null);
      setResumeIndex(lastIndex);
      setWatched((prev) => {
        const next = new Set(prev);
        for (let i = 0; i <= lastIndex && i < keys.length; i++) next.add(keys[i]);
        return next;
      });
    },
    [keys]
  );

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* ===== The EPG — one panel, one row per channel ===== */}
      <section className="panel-xbox relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          <h2 className="label-xbox">TONIGHT&apos;S PROGRAMMING</h2>
          {/* Desktop-only control hint — phones swipe, no room for it */}
          <span className="pixel-text text-[10px] text-text-muted hidden sm:inline">
            ▲▼ / ARROW KEYS
          </span>
        </div>

        <div className="px-2 pb-3">
          {items.map((item, i) => {
            const cover = coverOf(item);
            const isWatched = watched.has(keys[i]);
            return (
              /* A BUTTON, not a Link — tapping tunes the broadcast to
                 this channel in place instead of navigating away.
                 Press feedback is the global accent RING (globals.css
                 touch-feel block), never a shadow. Watched rows dim
                 but stay fully tappable — rewatching is allowed. */
              <button
                key={keys[i]}
                type="button"
                onClick={() => enterAt(i)}
                aria-label={`Tune to channel ${chNum(i)}: ${item.title}`}
                className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors hover:bg-white/[0.04] ${
                  isWatched ? "opacity-45" : ""
                }`}
              >
                {/* Channel number — the pixel OSD voice */}
                <span className="pixel-text text-xs text-accent-primary tabular-nums shrink-0 w-11">
                  CH {chNum(i)}
                </span>

                {/* 64px art slot */}
                <span className="w-16 h-16 rounded-md overflow-hidden border border-border-subtle bg-black/40 shrink-0 flex items-center justify-center">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl" aria-hidden="true">
                      {item.type === "debate"
                        ? "🎙️"
                        : item.type === "post"
                          ? "📺"
                          : "💿"}
                    </span>
                  )}
                </span>

                {/* Listing text: format chip, title, secondary + reason */}
                <span className="flex-1 min-w-0 space-y-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="label-xbox whitespace-nowrap shrink-0">
                      {FORMAT_LABEL[item.type]}
                    </span>
                    {/* Small accent tick = watched this session */}
                    {isWatched && (
                      <span
                        className="pixel-text text-[10px] text-accent-glow shrink-0"
                        aria-label="Watched"
                      >
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)]">
                    {item.title}
                  </span>
                  <span className="block text-xs text-text-secondary truncate">
                    {secondaryOf(item)}
                    {item.reason && (
                      <span className="text-accent-primary/80">
                        {" "}
                        · ◈ {item.reason}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="scan-bar" />
      </section>

      {/* ===== GO LIVE — the one big entry into the broadcast.
             btn-y2k-primary is the site's glowing accent button; its
             touch press state is the accent ring from the global
             touch-feel rules. Resumes where the session left off. ===== */}
      <button
        type="button"
        onClick={() => enterAt(resumeIndex ?? 0)}
        className="btn-y2k btn-y2k-primary w-full justify-center"
      >
        {resumeIndex !== null
          ? `RESUME AT CH ${chNum(resumeIndex)}`
          : "GO LIVE — START AT CH 01"}
      </button>

      {/* ===== The broadcast itself — mounted only while live (the
             frame is always-fullscreen; nothing heavy exists until
             the viewer opts in via GO LIVE or an EPG row). ===== */}
      {liveAt !== null && (
        <ChannelFrame
          items={items}
          initialIndex={liveAt}
          channelName={channelName}
          onExit={handleExit}
        />
      )}
    </div>
  );
}
