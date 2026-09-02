/**
 * HomeSection — the section header every logged-out home module
 * shares: a small VHS eyebrow, a big CRT title, one line of sub copy,
 * and the glowing rule. Same skeleton every time is what reads as
 * "professional" on the way down the page.
 */

import type { ReactNode } from "react";

export default function HomeSection({
  eyebrow,
  title,
  sub,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  /** Right-aligned extra (a count, a link). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="glow-orb" />
          <span className="vhs-label text-xs text-accent-glow">{eyebrow}</span>
          <div className="flex-1 divider-glow" />
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        <h2 className="crt-title text-2xl sm:text-4xl leading-tight">{title}</h2>
        {sub && (
          <p className="text-sm sm:text-base text-text-secondary max-w-2xl leading-relaxed">
            {sub}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
