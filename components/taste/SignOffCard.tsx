"use client";

/**
 * SignOffCard — card N+1 of the broadcast: END OF BROADCAST (WP8).
 *
 * When the viewer swipes past the last channel they don't hit a dead
 * rubber-band — they hit the classic sign-off: full-bleed SMPTE
 * color bars (pure CSS gradients, see .smpte-bars in globals.css —
 * huge and unmissable, zero cost) and three ways forward:
 *
 *  - RETUNE: a fresh mix WITHOUT leaving the frame. Clears the
 *    session (the resume pointer is meaningless for a new mix) but
 *    deliberately KEEPS the pmr_taste_seen cookie — that cookie is
 *    what makes the server downrank everything just watched, so
 *    keeping it is literally what rotates the pool. Then
 *    router.refresh() inside a transition: the server re-picks (seen
 *    downrank + day jitter — no new API route needed), the new items
 *    flow into ChannelFrame's props, and its mix-signature effect
 *    snaps home to CH 01. While the refresh is in flight the whole
 *    card is TUNING… static — the TV searching for the new signal.
 *  - TV GUIDE: off to /releases to browse the catalog directly.
 *  - BACK TO STATION: exit fullscreen to the lobby (peels the
 *    history layer like every other exit).
 *
 * Renders gracefully for ANY mix length — nothing here counts
 * channels, so a pool thinned below 12 by the WP2 guards still gets
 * a proper sign-off.
 *
 * The double LIGHT haptic on rubber-banding INTO this card lives in
 * ChannelFrame's settle handler (the card itself can't know when it
 * became the settled one without owning scroll state).
 */

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hapticTap } from "@/lib/native";

/** Must match ChannelFrame/TasteGuide — the session being cleared is
    the one the lobby would otherwise resume from. */
const SESSION_KEY = "pmr_taste_session";

export default function SignOffCard({
  channelName,
  onExit,
}: {
  /** "THE {NAME} CHANNEL SIGNS OFF" */
  channelName: string;
  /** Leave fullscreen (ChannelFrame passes its history peel). */
  onExit: () => void;
}) {
  const router = useRouter();
  // isPending is true from the click until the refreshed server
  // payload has actually rendered — exactly the window the TUNING…
  // static should cover.
  const [isPending, startTransition] = useTransition();

  const retune = () => {
    hapticTap();
    try {
      // The resume pointer dies (new mix, old index meaningless); the
      // SEEN COOKIE STAYS — it's what rotates the pool (see file
      // comment). ChannelFrame snaps to CH 01 when the items change.
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage blocked — refresh still works, resume just lingers */
    }
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="smpte-bars relative w-full h-full overflow-hidden">
      {/* Dark scrim panel so the OSD text wins over the bars */}
      <div className="relative h-full flex flex-col items-center justify-center px-6 pt-[calc(env(safe-area-inset-top)_+_56px)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-sm bg-black/75 border border-white/15 rounded-xl px-6 py-8 space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="crt-title text-2xl sm:text-3xl">
              END OF BROADCAST
            </h2>
            <p className="osd-text text-[11px] sm:text-xs">
              THE {channelName} CHANNEL SIGNS OFF
            </p>
          </div>

          <div className="space-y-3">
            {/* RETUNE — the headline action: a fresh mix, in place */}
            <button
              type="button"
              onClick={retune}
              disabled={isPending}
              className="btn-y2k btn-y2k-primary w-full justify-center disabled:opacity-60"
            >
              {isPending ? "RETUNING…" : "RETUNE — FRESH MIX"}
            </button>
            <Link
              href="/releases"
              onClick={() => hapticTap()}
              className="btn-y2k btn-y2k-outline w-full justify-center"
            >
              TV GUIDE
            </Link>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onExit();
              }}
              className="btn-y2k btn-y2k-outline w-full justify-center"
            >
              BACK TO STATION
            </button>
          </div>
        </div>
      </div>

      {/* RETUNE in flight: the whole card goes to static while the
          server re-picks — same shared noise tile as the channel
          bursts and embed skeletons. */}
      {isPending && (
        <div className="absolute inset-0 z-20 bg-black flex items-center justify-center">
          <div className="tv-noise absolute inset-0 opacity-30" aria-hidden="true" />
          <p className="tuning-label relative text-sm">TUNING…</p>
        </div>
      )}
    </div>
  );
}
