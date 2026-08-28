"use client";

/**
 * CallerComposer — the WRITE half of THE SWITCHBOARD (WP9), and the
 * ONE place in the broadcast where a keyboard is allowed to open.
 *
 * Why this shape: the old fullscreen comments sheet put a textarea
 * inside a sheet positioned within `.surf-fullscreen`. When the iOS
 * keyboard slides up, WebKit pans the VISUAL viewport to the focused
 * input, and a box placed in layout-viewport coordinates can drift
 * clean off screen (the documented ReportButton lesson — see
 * components/moderation/ReportButton.tsx's phone sheet). So writing
 * moves HERE: a `position:fixed` TOP sheet portaled to document.body
 * at z-[90] (above the tab bar's z-60 — same layer as the report
 * sheet, per the z-order contract), pinned at 12vh from the top over
 * a dimmed backdrop. A top-anchored box sits ABOVE the keyboard by
 * construction — no coordinate math to get wrong — which is why
 * autoFocus is allowed here and ONLY here (the read sheet underneath
 * contains zero inputs for exactly this reason).
 *
 * History contract (ChannelFrame's one-layer peeling): this layer
 * was opened with a {pmr:'composer'} pushState, so EVERY close path
 * — backdrop tap, successful send, Esc, Android back, iOS edge
 * swipe — goes through onClose = history.back(); the popstate
 * listener then clears the composer state. Never close by setState
 * directly or the history stack drifts one entry out of step.
 */

import { useState } from "react";
import { createPortal } from "react-dom";

/** What the composer is replying to — null parentId = a fresh
    top-level comment from the WRITE pill; a Reply tap fills all
    three so the caller sees WHOSE words they're answering. */
export interface ComposerCtx {
  parentId: string | null;
  replyToName: string | null;
  quote: string | null;
}

export default function CallerComposer({
  ctx,
  onSubmit,
  onClose,
}: {
  ctx: ComposerCtx;
  /** Posts through CommentsSection's own path (the ref handle) —
      resolves on success, throws the server's message (content
      filter, rate limit…) on rejection. */
  onSubmit: (content: string) => Promise<void>;
  /** = history.back(): peels this one layer via popstate. */
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Server rejections surface here — the text stays in the box so
  // nothing typed is lost (same rule as CommentForm).
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(content.trim());
      // Success: the comment is already inserted in the read sheet
      // (optimistic insert) — close this layer so the caller SEES
      // their call land on the line.
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't post that — try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <>
      {/* Dimmed backdrop — tapping away hangs up (one history layer). */}
      <div
        className="fixed inset-0 z-[89] bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* The fixed TOP sheet — keyboard-safe by construction. */}
      <form
        onSubmit={send}
        className="fixed z-[90] top-[12vh] left-4 right-4 max-w-md mx-auto rounded-lg border border-accent-primary/30 bg-[#0c0c0f] p-4 space-y-3"
      >
        {/* The switchboard operator's voice */}
        <p className="osd-text text-xs">GO AHEAD, CALLER</p>

        {/* Reply context — the quoted parent, so mid-thread the
            caller never loses WHO they're talking to. */}
        {ctx.parentId && (
          <div className="border-l-2 border-accent-primary/40 pl-3 space-y-0.5">
            <p className="pixel-text text-[9px] uppercase tracking-widest text-text-muted">
              REPLYING TO {ctx.replyToName}
            </p>
            {ctx.quote && (
              <p className="text-xs text-text-secondary italic line-clamp-2 break-words">
                “{ctx.quote}”
              </p>
            )}
          </div>
        )}

        {/* The CRT OSD input (.osd-input, globals.css). autoFocus is
            SAFE in this component alone — see the file comment.
            maxLength mirrors the route's 2000-char server cap so the
            caller hits the wall while typing, not on send. */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Speak your piece…"
          rows={3}
          maxLength={2000}
          autoFocus
          className="osd-input resize-none"
        />

        {error && (
          <p className="text-xs text-accent-rose border border-accent-rose/30 bg-accent-rose/5 rounded px-3 py-2">
            {error}
          </p>
        )}

        {/* SEND — press feedback is the global accent RING rules
            (never shadows), nothing custom needed here. */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="px-5 py-1.5 rounded-full pixel-text text-xs uppercase tracking-widest bg-accent-primary/15 text-accent-glow border border-accent-primary/40 hover:bg-accent-primary/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "…" : "SEND ▸"}
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}
