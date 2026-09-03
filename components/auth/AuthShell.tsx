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

import { useState, type ReactNode } from "react";
import Link from "next/link";
import LiquidAtmosphere from "@/components/ui/LiquidAtmosphere";
import { useTranslations } from "next-intl";

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
  // LANGUAGES: the shell's own three words (messages → "auth.shell").
  const t = useTranslations("auth.shell");
  // Direction of the slide: forward when the step number grows,
  // back when it shrinks. Tracked here so pages don't have to.
  // This is React's "store the previous prop in state" pattern: when
  // the step changes we set state DURING render, and React re-runs
  // the render immediately with the new direction before painting —
  // so the very first frame of the new step already slides the right
  // way (the old effect version painted once, then corrected).
  const current = step ?? 0;
  const [prevStep, setPrevStep] = useState(current);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  if (current !== prevStep) {
    setDirection(current > prevStep ? "forward" : "back");
    setPrevStep(current);
  }

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
              {t("back")}
            </button>
          )}

          {/* Logo + progress dots */}
          <div className="flex flex-col items-center gap-3 mb-7">
            <Link href="/" aria-label={t("homeAria")} className="block">
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
  children,
  disabled,
  loading,
}: {
  children?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
}) {
  const t = useTranslations("auth.shell");
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="btn-y2k btn-y2k-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed mt-5"
    >
      {loading ? t("tuningIn") : (children ?? t("continue"))}
    </button>
  );
}
