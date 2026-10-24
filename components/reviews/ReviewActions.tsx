"use client";

/**
 * ReviewActions — the one action row under a finished review's header
 * (Luca 2026-10-24, sleeve option 1): Like · Comment · Share · ⋯.
 * No boxes; a hairline above and below, like a record's run-out groove.
 *
 * ⋯ holds the quieter things: the release page, and Report (it used to
 * sit out in the open beside the like count). Report still has to be
 * one tap from the review for App Store guideline 1.2 — it is: ⋯ → 🚩.
 *
 * The menu is hidden with visibility, never unmounted: ReportButton
 * keeps its own popover in a portal, and unmounting the menu the moment
 * someone taps inside that popover would throw their report away.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LikeButton from "@/components/reviews/LikeButton";
import ReportButton from "@/components/moderation/ReportButton";
import { hapticTap, shareLink } from "@/lib/native";

export default function ReviewActions({
  reviewId,
  likeCount,
  liked,
  shareTitle,
  shareUrl,
  releaseHref,
  labels,
}: {
  reviewId: string;
  likeCount: number;
  liked: boolean;
  shareTitle: string;
  shareUrl: string;
  releaseHref: string | null;
  labels: { comment: string; share: string; more: string; viewRelease: string };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu on a tap anywhere outside it (the report popover
  // included — the report itself stays open, see the note up top).
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="review-actions">
      <LikeButton reviewId={reviewId} initialCount={likeCount} initialLiked={liked} size="md" />
      <a href="#comments" className="review-action">
        <span aria-hidden="true">💬</span>
        <b>{labels.comment}</b>
      </a>
      <button
        type="button"
        className="review-action"
        onClick={() => {
          hapticTap();
          shareLink(shareTitle, shareUrl);
        }}
      >
        <span aria-hidden="true">↗</span>
        <b>{labels.share}</b>
      </button>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          className="review-action review-action-more"
          aria-label={labels.more}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          ⋯
        </button>
        <div
          role="menu"
          className={`review-menu ${menuOpen ? "is-open" : ""}`}
          aria-hidden={!menuOpen}
        >
          {releaseHref && (
            <Link href={releaseHref} role="menuitem" className="review-menu-item" tabIndex={menuOpen ? 0 : -1}>
              {labels.viewRelease}
            </Link>
          )}
          <div className="review-menu-item review-menu-report">
            <ReportButton targetType="review" targetId={reviewId} />
          </div>
        </div>
      </div>
    </div>
  );
}
