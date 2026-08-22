"use client";

/**
 * ReportButton — the 🚩 on every piece of user content.
 *
 * Click → inline popover with a reason box → POST /api/reports.
 * On success the button becomes a muted "Reported ✓" so the same
 * viewer can't spam-file against one target from the UI.
 *
 * Required by App Store guideline 1.2: UGC apps must give users a
 * way to flag objectionable content.
 */

import { useEffect, useRef, useState } from "react";
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

export default function ReportButton({
  targetType,
  targetId,
  small = false,
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function submit() {
    const trimmed = reason.trim();
    if (trimmed.length < 3 || submitting) return;
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

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-border-medium bg-[#141418] p-3 shadow-[0_16px_50px_rgba(0,0,0,0.8)] space-y-2">
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
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                autoFocus
                placeholder="What's wrong with it? (3–500 chars)"
                className="form-input !text-xs resize-none"
              />
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
                  disabled={reason.trim().length < 3 || submitting}
                  className="text-[11px] uppercase tracking-wider font-bold text-accent-rose border border-accent-rose/40 rounded px-2 py-1 hover:bg-accent-rose/10 disabled:opacity-40 transition-colors"
                >
                  {submitting ? "…" : "Submit"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
