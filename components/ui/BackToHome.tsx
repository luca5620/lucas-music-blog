"use client";

/**
 * BackToHome — app-only "← Home" link at the top of the four browse
 * pages (Reviews / Releases / Debates / Lists).
 *
 * In the native shell those pages are reached from the home page's
 * quick-access strip and live on NO bottom tab, so there was no way
 * back except the Home tab itself (Luca 2026-08-26: "there should be
 * a back button to go back to the home page"). Web hides it — the
 * top nav already links Home everywhere.
 */

import Link from "next/link";
import { hapticTap } from "@/lib/native";

export default function BackToHome() {
  return (
    <div className="app-only">
      <Link
        href="/"
        onClick={() => hapticTap()}
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
      >
        ← Back to Home
      </Link>
    </div>
  );
}
