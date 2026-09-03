/**
 * ClosingCta — the last thing a logged-out visitor sees after the
 * whole scroll (Luca 2026-09-02, after Resonate's "Start the diary
 * you'll actually keep"). Same glowing panel + liquid as the hero so
 * the page closes the way it opened. The App Store badge is handed
 * in by the page (it lives there, web-only).
 */

import Link from "next/link";
import type { ReactNode } from "react";
import LiquidAtmosphere from "@/components/ui/LiquidAtmosphere";

export default function ClosingCta({ badge }: { badge?: ReactNode }) {
  return (
    <section className="panel-xbox-glow p-8 sm:p-12 text-center space-y-5 relative isolate overflow-hidden">
      <LiquidAtmosphere />
      <div className="absolute top-4 left-4 glow-orb" />
      <div className="absolute top-4 right-4 glow-orb" style={{ animationDelay: "1.2s" }} />

      <p className="vhs-label text-xs text-accent-glow">Your channel is waiting</p>
      <h2 className="crt-title text-3xl sm:text-5xl leading-tight">
        Start the log you&apos;ll actually keep.
      </h2>
      <p className="hero-copy max-w-xl mx-auto text-xs sm:text-sm leading-relaxed">
        Free. Your first rating takes two taps. Web and iOS.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-center pt-1">
        <Link href="/signup" className="btn-y2k btn-y2k-primary">
          Create Account
        </Link>
        <Link href="/login" className="btn-y2k btn-y2k-outline">
          Sign In
        </Link>
        {badge}
      </div>
      <div className="scan-bar" />
    </section>
  );
}
