"use client";

/**
 * ReportButton — the 🚩 on every piece of user content.
 *
 * Click → popover with a multi-select reason checklist (categories
 * from App Store guideline 1.2 + our Terms house rules; "Other"
 * opens a free-text box) → POST /api/reports.
 * On success the button becomes a muted "Reported ✓" so the same
 * viewer can't spam-file against one target from the UI.
 *
 * The popover renders into document.body (createPortal) in viewport
 * coordinates, clamped to the screen edges — anchored `right-0` it
 * extended 256px to the LEFT of the flag, so any flag sitting near
 * the left edge of a comment/chat row pushed the box mostly
 * off-screen (and card overflow could clip it too). Same structural
 * fix as CatalogSearch's portal dropdown.
 *
 * Required by App Store guideline 1.2: UGC apps must give users a
 * way to flag objectionable content.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

interface ReportButtonProps {
  targetType:
    | "review"
    | "comment"
    | "list"
    | "debate"
    | "debate_message"
    | "room_message"
    | "profile"
    | "post";
  targetId: string;
  /** Tighter icon-only styling for dense rows (comments, chat). */
  small?: boolean;
}

const POPOVER_WIDTH = 256; // w-64
// Worst-case rendered height (header + reason checklist + error line +
// buttons), used only to decide whether to flip above the flag near the
// bottom of the screen.
const POPOVER_EST_HEIGHT = 380;
const EDGE_GAP = 8;

/**
 * Report reasons, drawn from App Store guideline 1.2's list of what
 * makes UGC objectionable (bullying, threats, porn/shock content,
 * objectification, IP infringement) merged with our own Terms house
 * rules. Multi-select; "Other" opens a free-text box. The selection
 * is joined into the plain-text `reason` the API already accepts —
 * no server/DB change needed.
 */
const REPORT_REASONS = [
  "Harassment or bullying",
  "Hate speech or slurs",
  "Threats or violence",
  "Sexually explicit or shock content",
  "Spam or scam",
  "Impersonation",
  "Sharing private information",
  "Piracy or stolen content",
] as const;

const OTHER = "Other";

export default function ReportButton({
  targetType,
  targetId,
  small = false,
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Popover position in viewport coordinates, clamped so the full
  // box is always on screen no matter where the flag sits.
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(
    null,
  );

  const measure = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const left = Math.min(
      Math.max(r.right - POPOVER_WIDTH, EDGE_GAP),
      Math.max(vw - POPOVER_WIDTH - EDGE_GAP, EDGE_GAP),
    );
    // Prefer below the flag; flip above when the bottom of the screen
    // (visualViewport when the keyboard is up) leaves no room.
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const below = r.bottom + 8;
    const top =
      below + POPOVER_EST_HEIGHT > vh - EDGE_GAP
        ? Math.max(r.top - 8 - POPOVER_EST_HEIGHT, EDGE_GAP)
        : below;
    setAnchor({ left, top });
  }, []);

  // Keep the popover glued to the flag while open: page scroll
  // (capture — the scroller may be any ancestor), resizes, and the
  // mobile keyboard showing/hiding all move the anchor.
  useEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  // Close on outside click — the portal box lives outside boxRef in
  // the DOM, so clicks inside it must count as inside.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (
        boxRef.current &&
        !boxRef.current.contains(t) &&
        !(popRef.current && popRef.current.contains(t))
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggleReason(label: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // Valid = at least one reason picked, and "Other" (if picked)
  // actually says something.
  const otherNeedsText = selected.has(OTHER) && otherText.trim().length < 3;
  const canSubmit = selected.size > 0 && !otherNeedsText && !submitting;

  async function submit() {
    if (!canSubmit) return;
    // Join the picks into the plain-text reason the API stores.
    // "Other" carries its free text; cap keeps us under the DB's
    // 500-char reason limit no matter what.
    const parts = REPORT_REASONS.filter((r) => selected.has(r)).map(String);
    if (selected.has(OTHER)) parts.push(`Other: ${otherText.trim()}`);
    const trimmed = parts.join("; ").slice(0, 500);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason: trimmed,
        }),
      });
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Report failed");
      setDone(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <span
        className={`text-text-muted ${small ? "text-[10px]" : "text-xs"} whitespace-nowrap`}
      >
        Reported ✓
      </span>
    );
  }

  return (
    // inline-flex + items-center (was inline-block with padding): the
    // emoji now vertically centers with the pixel-text action buttons
    // it sits beside in comment/chat rows instead of drifting off the
    // baseline.
    <div ref={boxRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Report this content"
        aria-label="Report this content"
        className={`text-text-muted hover:text-accent-rose transition-colors ${
          small
            ? "text-[10px] leading-none inline-flex items-center"
            : "text-xs px-2 py-1 rounded border border-transparent hover:border-accent-rose/30"
        }`}
      >
        🚩{!small && <span className="ml-1 uppercase tracking-wider">Report</span>}
      </button>

      {open &&
        anchor &&
        createPortal(
          /* Phones: a fixed top sheet + dimmed backdrop. The anchored
             popover kept losing to the iOS keyboard — when it slides
             up, iOS pans the VISUAL viewport to the focused textarea,
             and a box placed in layout-viewport coordinates can land
             entirely outside the visible region (Luca had to close
             the keyboard to find it). Pinned at 12vh from the top,
             the sheet sits above the keyboard by construction — no
             coordinate math to get wrong. md+: anchored popover. */
          <>
            <div
              className="fixed inset-0 z-[89] bg-black/60 md:hidden"
              onClick={() => setOpen(false)}
            />
            <div
              ref={popRef}
              style={
                {
                  "--pop-left": `${anchor.left}px`,
                  "--pop-top": `${anchor.top}px`,
                } as React.CSSProperties
              }
              className="fixed z-[90] left-4 right-4 top-[12vh] max-w-sm mx-auto md:left-[var(--pop-left)] md:right-auto md:top-[var(--pop-top)] md:mx-0 md:w-64 rounded-lg border border-border-medium bg-[#141418] p-3 shadow-[0_16px_50px_rgba(0,0,0,0.8)] space-y-2"
            >
            {needsLogin ? (
              <p className="text-xs text-text-secondary">
                <Link href="/login" className="text-accent-primary hover:underline">
                  Sign in
                </Link>{" "}
                to report content.
              </p>
            ) : (
              <>
                <p className="text-xs font-bold text-text-primary uppercase tracking-wider font-[family-name:var(--font-heading)]">
                  Report this
                </p>
                <p className="text-[11px] text-text-muted">
                  What&apos;s wrong with it? Pick all that apply.
                </p>

                {/* Reason checklist — scrolls if the screen is short. */}
                <div className="space-y-1 max-h-[45vh] overflow-y-auto pr-1">
                  {[...REPORT_REASONS, OTHER].map((label) => (
                    <label
                      key={label}
                      className="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer select-none hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(label)}
                        onChange={() => toggleReason(label)}
                        className="w-3.5 h-3.5 shrink-0 accent-[#ff4455]"
                      />
                      <span className="text-xs text-text-secondary">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Free text only when "Other" is picked. */}
                {selected.has(OTHER) && (
                  <textarea
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    maxLength={300}
                    rows={2}
                    autoFocus
                    placeholder="Tell us what's wrong (3–300 chars)"
                    className="form-input !text-xs resize-none"
                  />
                )}

                {error && <p className="text-[11px] text-accent-rose">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-[11px] uppercase tracking-wider text-text-muted hover:text-text-primary px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!canSubmit}
                    className="text-[11px] uppercase tracking-wider font-bold text-accent-rose border border-accent-rose/40 rounded px-2 py-1 hover:bg-accent-rose/10 disabled:opacity-40 transition-colors"
                  >
                    {submitting ? "…" : "Submit Report"}
                  </button>
                </div>
              </>
            )}
          </div>
          </>,
          document.body,
        )}
    </div>
  );
}
