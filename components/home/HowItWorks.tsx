/**
 * HowItWorks — the three-step strip on the logged-out home (Luca
 * 2026-09-02, after Resonate's "Find the record / Give it a score /
 * Say why" — ours ends in the live room, because that's the pitch).
 * Big numerals, a VHS label each, one line of copy, and a small live
 * prop in each card so it isn't three blocks of text.
 */

import Link from "next/link";
import HomeSection from "./HomeSection";
import Reveal from "./Reveal";

const STEPS = [
  {
    n: "01",
    label: "Find the record",
    body: "Every album and single on Spotify, plus the Genius deep catalog. Not out yet? Paste the Spotify link and it's on the platform with a countdown.",
    prop: (
      <div className="form-input text-sm text-text-muted flex items-center gap-2 pointer-events-none select-none">
        <span className="opacity-60">⌕</span>
        <span className="truncate">search any album, song, or artist…</span>
      </div>
    ),
  },
  {
    n: "02",
    label: "Give it a number",
    body: "Zero to ten, one decimal. No stars, no rounding. Your number rides on every card you post, in the color it earns.",
    prop: (
      <div className="flex items-center gap-3">
        {[
          ["6.4", "#e0b355"],
          ["8.7", "#4dacff"],
          ["9.6", "#b57cff"],
        ].map(([v, c]) => (
          <span
            key={v}
            className="rating-badge text-sm w-11 h-11"
            style={{ color: c, borderColor: c }}
          >
            {v}
          </span>
        ))}
      </div>
    ),
  },
  {
    n: "03",
    label: "Argue it live",
    body: "Every release has a live room. The album drops at midnight and the chat is already going. Sure of yourself? Start a two-sided debate.",
    prop: (
      <div className="flex items-center gap-2 text-xs">
        <span className="glow-orb" />
        <span className="vhs-label text-[10px] text-accent-glow">On air</span>
        <span className="text-text-secondary truncate">“track 4 is the one, argue with me”</span>
      </div>
    ),
  },
];

export default function HowItWorks() {
  return (
    <HomeSection
      eyebrow="How it works"
      title="Three steps. Then it's your channel."
      sub="No onboarding maze. Find it, rate it, say it out loud."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 110}>
            <div className="panel-xbox p-5 sm:p-6 h-full flex flex-col gap-4 hover-glow relative overflow-hidden">
              <div className="flex items-baseline justify-between gap-3">
                <span className="crt-title text-4xl sm:text-5xl text-accent-glow leading-none">
                  {s.n}
                </span>
                <span className="vhs-label text-xs">{s.label}</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed flex-1">{s.body}</p>
              <div className="pt-1">{s.prop}</div>
              <div className="scan-bar" style={{ animationDelay: `${i * 0.7}s` }} />
            </div>
          </Reveal>
        ))}
      </div>
      <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
        step four is optional and it&apos;s{" "}
        <Link href="/lists" className="text-accent-primary hover:underline">
          lists
        </Link>
        . everyone ends up making lists.
      </p>
    </HomeSection>
  );
}
