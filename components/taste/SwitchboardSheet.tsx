"use client";

/**
 * SwitchboardSheet — the READ half of THE SWITCHBOARD (WP9): the
 * broadcast's comments as a call-in show. "CALLERS ON THE LINE" is
 * the queue; the WRITE pill (and every Reply button) patches you
 * through to the CallerComposer.
 *
 * The load-bearing constraint: this bottom sheet is absolutely
 * positioned INSIDE `.surf-fullscreen` — which is only safe because
 * it contains ZERO inputs. No form, no inline reply/edit textareas,
 * no autoFocus (CommentsSection's `variant="sheet"` strips all of
 * them). The keyboard can never open here, so the fixed sheet can
 * never drift the way the old read+write sheet did on iOS. All
 * WRITING happens in the CallerComposer, a separate ReportButton-
 * pattern fixed TOP sheet portaled to document.body at z-[90] —
 * keyboard-safe by construction.
 *
 * Layer choreography (owned by ChannelFrame, not here): the sheet
 * sits on a {pmr:'callers'} history entry, the composer on
 * {pmr:'composer'}. onPeel = history.back() closes exactly one
 * layer; which layers are OPEN arrives as props (composer), so the
 * popstate listener in ChannelFrame stays the single source of
 * truth for the whole stack.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import CommentsSection, {
  type CommentsSectionHandle,
} from "@/components/reviews/CommentsSection";
import CallerComposer, { type ComposerCtx } from "./CallerComposer";
import { hapticTap } from "@/lib/native";

export default function SwitchboardSheet({
  reviewId,
  initialCount,
  composer,
  onOpenComposer,
  onPeel,
}: {
  reviewId: string;
  /** Seed for the header count (the payload's comment_count — same
      number the rail button shows); the live post-block-filter
      count from CommentsSection takes over once loaded. */
  initialCount: number;
  /** Non-null = the composer layer is up (ChannelFrame state). */
  composer: ComposerCtx | null;
  /** Pushes the {pmr:'composer'} history entry + opens the sheet. */
  onOpenComposer: (ctx: ComposerCtx) => void;
  /** = history.back(): closes the TOP layer via popstate. */
  onPeel: () => void;
}) {
  const { user } = useAuth();
  // The one comments write path — the composer posts through this
  // handle so success lands as an optimistic insert in OUR list.
  const commentsRef = useRef<CommentsSectionHandle>(null);
  const [count, setCount] = useState(initialCount);

  return (
    <>
      {/* Backdrop over the card — tap = hang up (peel one layer). */}
      <div className="absolute inset-0 z-20 bg-black/60" onClick={onPeel} />

      {/* The sheet. Absolute inside .surf-fullscreen (SAFE: zero
          inputs — see file comment). Accent top edge + noise +
          scan-bar = CRT character, not a flat rectangle. */}
      <div className="absolute inset-x-0 bottom-0 top-[18%] z-30 bg-[#0c0c0f] border-t border-accent-primary/25 rounded-t-2xl flex flex-col overflow-hidden">
        {/* ── Header: the switchboard's status line ── */}
        <div className="relative shrink-0 border-b border-white/5">
          {/* TV-static wash along the sheet's top edge (the shared
              noise tile — static, zero cost). */}
          <div
            className="tv-noise absolute inset-0 opacity-[0.07] pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between gap-3 pl-4 pr-2.5 py-2.5">
            <span className="osd-text text-xs truncate">
              CALLERS ON THE LINE · {count}
            </span>
            {/* 44px close — same hit-target rule as AV/EXIT. */}
            <button
              type="button"
              onClick={onPeel}
              aria-label="Close callers"
              className="w-11 h-11 shrink-0 rounded-full border border-border-medium text-text-secondary hover:text-accent-primary hover:border-accent-primary/60 transition-colors flex items-center justify-center"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {/* Sweeping accent line — already thermal-gated globally
              (.native-app:not(.motion-on) pauses .scan-bar::after). */}
          <div className="scan-bar" aria-hidden="true" />
        </div>

        {/* ── WRITE — the door to the composer. Full-width accent
            pill right under the header, per spec. Signed-out
            viewers get the sign-in door instead (a composer they
            can't post from would be a lie). ── */}
        <div className="shrink-0 px-4 pt-3">
          {user ? (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                // Fresh top-level call — no reply context.
                onOpenComposer({
                  parentId: null,
                  replyToName: null,
                  quote: null,
                });
              }}
              className="w-full py-2.5 rounded-full pixel-text text-xs uppercase tracking-widest bg-accent-primary/15 text-accent-glow border border-accent-primary/40 hover:bg-accent-primary/25 transition-all"
            >
              WRITE ▸
            </button>
          ) : (
            <Link
              href="/login"
              className="block w-full py-2.5 rounded-full text-center pixel-text text-xs uppercase tracking-widest text-text-muted border border-border-medium hover:text-accent-primary hover:border-accent-primary/60 transition-all"
            >
              SIGN IN TO CALL IN
            </Link>
          )}
        </div>

        {/* ── The line itself: CommentsSection in sheet dress (no
            chrome, no forms — reply taps patch through to the
            composer). Contained scroller so a read-scroll never
            chains into the channel pager behind it. ── */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 [scrollbar-width:thin]">
          <CommentsSection
            ref={commentsRef}
            reviewId={reviewId}
            variant="sheet"
            onCountChange={setCount}
            onRequestReply={onOpenComposer}
          />
        </div>
      </div>

      {/* ── The WRITE layer — portals itself to document.body, so
          rendering it from in here still escapes .surf-fullscreen
          (it must sit at z-[90], above the z-60 tab bar). ── */}
      {composer && (
        <CallerComposer
          ctx={composer}
          onClose={onPeel}
          onSubmit={(content) =>
            // Post through the read sheet's own path; the successful
            // insert shows up on the line before the composer closes.
            commentsRef.current
              ? commentsRef.current.post(content, composer.parentId)
              : Promise.reject(new Error("Comments are still loading."))
          }
        />
      )}
    </>
  );
}
