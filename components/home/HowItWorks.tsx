/**
 * HowItWorks — the three-step strip on the logged-out home (Luca
 * 2026-09-02, after Resonate's "Find the record / Give it a score /
 * Say why" — ours ends in the live room, because that's the pitch).
 * Big numerals, a VHS label each, one line of copy, and a small live
 * prop in each card so it isn't three blocks of text.
 *
 * LANGUAGES: server component → getTranslations("home.howItWorks").
 * The STEPS list moved inside the component because its labels and
 * props need `t`; it's rebuilt per request, which is free (it's three
 * small objects).
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import HomeSection from "./HomeSection";
import Reveal from "./Reveal";

export default async function HowItWorks() {
  const t = await getTranslations("home.howItWorks");

  const steps = [
    {
      n: "01",
      label: t("step1Label"),
      body: t("step1Body"),
      prop: (
        <div className="form-input text-sm text-text-muted flex items-center gap-2 pointer-events-none select-none">
          <span className="opacity-60">⌕</span>
          <span className="truncate">{t("step1Prop")}</span>
        </div>
      ),
    },
    {
      n: "02",
      label: t("step2Label"),
      body: t("step2Body"),
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
      label: t("step3Label"),
      body: t("step3Body"),
      prop: (
        <div className="flex items-center gap-2 text-xs">
          <span className="glow-orb" />
          <span className="vhs-label text-[10px] text-accent-glow">{t("onAir")}</span>
          <span className="text-text-secondary truncate">{t("step3Prop")}</span>
        </div>
      ),
    },
  ];

  return (
    <HomeSection eyebrow={t("eyebrow")} title={t("title")} sub={t("sub")}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {steps.map((s, i) => (
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
        {/* t.rich: the <link> tag in the message becomes the real Link,
            so each language can put "lists" wherever its grammar wants. */}
        {t.rich("stepFour", {
          link: (chunks) => (
            <Link href="/lists" className="text-accent-primary hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </HomeSection>
  );
}
