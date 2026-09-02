"use client";

/**
 * AuthShell — the one-question-per-screen frame for /signup and /login
 * (Luca 2026-09-02, "more professional looking sign up/in process").
 *
 * The reference: an iOS onboarding where every screen is the SAME
 * skeleton — small logo up top, a row of progress dots under it, one
 * big question, a one-line helper, ONE field, ONE wide Continue. No
 * form with five inputs and a checkbox stacked in a box. Each step
 * slides in from the right; going back slides from the left.
 *
 * Kept from the house style so it doesn't read as a generic login
 * page: the glowing panel, the liquid atmosphere drifting behind it,
 * the CRT title face for the question, the y2k buttons, the scan bar.
 *
 * Purely presentational — the pages own every bit of logic.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import LiquidAtmosphere from "@/components/ui/LiquidAtmosphere";

interface AuthShellProps {
  /** The question for this screen — short, sentence case. */
  title: string;
  /** One line under it: what the answer is for. */
  helper?: ReactNode;
  /** 0-based index of the current dot; omit `steps` to hide the row. */
  step?: number;
  steps?: number;
  /** Shown as a small ← at the top-left when provided. */
  onBack?: () => void;
  /** The field(s) + button for this screen. */
  children: ReactNode;
  /** Small line under the panel: "Already have an account? Sign in". */
  footer?: ReactNode;
  /** Red line above the children — the page hands it in. */
  error?: string | null;
}

export default function AuthShell({
  title,
  helper,
  step,
  steps,
  onBack,
  children,
  footer,
  error,
}: AuthShellProps) {
  // Direction of the slide: forward when the step number grows,
  // back when it shrinks. Tracked here so pages don't have to.
  const lastStep = useRef(step ?? 0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  useEffect(() => {
    const current = step ?? 0;
    if (current !== lastStep.current) {
      setDirection(current > lastStep.current ? "forward" : "back");
      lastStep.current = current;
    }
  }, [step]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm">
        <div className="panel-xbox-glow relative isolate overflow-hidden px-6 py-8 sm:px-8">
          <LiquidAtmosphere />

          {/* Back arrow — a press target, not a swipe (Luca's rule for
              sheets applies here too). */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="auth-back absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 pl-2.5 pr-3.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-text-secondary hover:text-text-primary hover:border-[rgba(var(--accent-rgb),0.6)] transition-colors font-[family-name:var(--font-heading)]"
            >
              <svg
                viewBox="0 0 16 16"
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 3L5 8l5 5" />
              </svg>
              Back
            </button>
          )}

          {/* Logo + progress dots */}
          <div className="flex flex-col items-center gap-3 mb-7">
            <Link href="/" aria-label="Peak Music Reviews home" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/penguin-logo.png"
                alt=""
                width={56}
                height={56}
                className="w-14 h-14 rounded-2xl border border-white/15 shadow-[0_0_24px_rgba(var(--accent-rgb),0.35)]"
              />
            </Link>
            {typeof steps === "number" && steps > 0 && (
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {Array.from({ length: steps }).map((_, i) => {
                  const state =
                    i === (step ?? 0) ? "active" : i < (step ?? 0) ? "done" : "todo";
                  return <span key={i} className={`auth-dot auth-dot-${state}`} />;
                })}
              </div>
            )}
          </div>

          {/* The step — keyed by title so a new question re-runs the
              slide-in animation. */}
          <div
            key={title}
            className={direction === "forward" ? "auth-step-in" : "auth-step-back"}
          >
            <div className="text-center space-y-2 mb-6">
              <h1 className="crt-title text-2xl sm:text-[1.7rem] leading-tight">
                {title}
              </h1>
              {helper && (
                <p className="text-sm text-text-secondary leading-relaxed">{helper}</p>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {children}
          </div>

          <div className="scan-bar" />
        </div>

        {footer && (
          <p className="mt-5 text-center text-sm text-text-secondary">{footer}</p>
        )}
      </div>
    </div>
  );
}

/** The one wide primary button every step ends with. */
export function ContinueButton({
  children = "Continue",
  disabled,
  loading,
}: {
  children?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="btn-y2k btn-y2k-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed mt-5"
    >
      {loading ? "Tuning in…" : children}
    </button>
  );
}
