/**
 * /letterboxd-for-music — the "is there a Letterboxd for music?"
 * landing page.
 *
 * Why this page exists (SEO sprint follow-up, 2026-08-25): this is
 * the single most common way people ask for exactly what Peak is —
 * every competitor's press coverage uses the phrase, and the SERP for
 * it is thin listicles that rank five sites without recommending one.
 * We ARE the direct answer, so the page says so in the first 100
 * words and then proves it with the feature mapping.
 *
 * Content rules (same playbook as /musicboard-alternative):
 *  - Answer-first: direct claim up top — AI engines quote that block.
 *  - Letterboxd is someone else's trademark: state plainly we're not
 *    affiliated, never imitate their branding, and talk about them
 *    only as "the thing people are comparing to."
 *  - Honesty over hype: the mapping table admits what we DON'T have
 *    (no listen-later shelf, no year-end stats). Honest pages get
 *    cited; ads don't.
 *  - Facts about competitors stay dated and attributed (the
 *    Musicboard situation links to our own comparison page — internal
 *    linking is half the point).
 */

import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import FAQSchema from "@/components/seo/FAQSchema";
import { BreadcrumbSchema } from "@/app/schema";
import { getLetterboxdFAQs } from "@/lib/faq-data";
import { APP_STORE_URL, isAppStoreLive } from "@/lib/app-store";

export const metadata: Metadata = {
  title: "The Letterboxd for Music — rate & review albums in 2026",
  description:
    "Looking for a Letterboxd for music? Peak Music Reviews is it: 0–10 album ratings, written reviews, lists, four profile favorites, live release-night rooms and debates — free, on web and iOS.",
  alternates: {
    canonical: "https://peakmusicreviews.com/letterboxd-for-music",
  },
  openGraph: {
    type: "article",
    url: "https://peakmusicreviews.com/letterboxd-for-music",
    title: "The Letterboxd for Music — rate & review albums in 2026",
    description:
      "How the Letterboxd formula maps onto albums: Peak Music Reviews vs Musicboard, RateYourMusic, Album of the Year and Last.fm — an honest guide.",
  },
};

/* ─────────────── The formula, mapped ───────────────
   One row per Letterboxd concept people expect a music version of.
   `peak` is a string (we always explain, never just check a box) —
   and two rows are honest "not yet" admissions on purpose. */
const MAPPING: { lb: string; peak: string; gap?: boolean }[] = [
  {
    lb: "Films",
    peak: "Albums and songs — the full Spotify catalog plus Genius deep cuts, unreleased tracks included",
  },
  {
    lb: "Half-star ratings",
    peak: "0–10.0 with one decimal — enough range to mean it",
  },
  {
    lb: "Written reviews",
    peak: "Written reviews with likes and comments",
  },
  {
    lb: "Four favorite films on your profile",
    peak: "Four favorite albums on your profile — we kept this one on purpose",
  },
  {
    lb: "Lists",
    peak: "Lists — public or private, any release in the catalog",
  },
  {
    lb: "Following + activity feed",
    peak: "Follow anyone; a Who You Follow feed plus a For You page ranked by your taste",
  },
  {
    lb: "Custom profiles",
    peak: "Six visual themes, arrangeable showcases, avatar + banner uploads",
  },
  {
    lb: "Premieres & opening nights",
    peak: "Live release-night chat rooms on album pages — the music-native feature film sites can't have",
  },
  {
    lb: "Watchlist",
    peak: "No dedicated listen-later shelf yet — most members keep a list for it",
    gap: true,
  },
  {
    lb: "Year-in-review stats",
    peak: "Not yet — a Song of the Day streak is the closest daily ritual for now",
    gap: true,
  },
  {
    lb: "Pro subscription",
    peak: "Everything above is free; optional patron perks are planned",
  },
];

/* ─────────────── The other claimants ───────────────
   Honest mini-verdicts, including where they beat us — mirrors the
   OTHERS block on /musicboard-alternative (Musicboard added here
   because for years it WAS the default answer to this query). */
const OTHERS = [
  {
    name: "Musicboard",
    verdict:
      "Held the title for a while — same review/list/profile formula, app-first. But as of August 2026 it's in visible decline: repeated outages, the Android app pulled from Google Play, no iOS update since May 2025. We wrote an honest full comparison for anyone switching.",
    label: "THE FADING ONE",
    href: "/musicboard-alternative",
    hrefLabel: "Read the comparison →",
  },
  {
    name: "RateYourMusic",
    verdict:
      "The deepest ratings database and genre charts on the internet, built over two decades. But it's web-only, the interface hasn't meaningfully changed in years, and there's no real social layer. Pick it if you want an encyclopedia, not a community.",
    label: "THE ARCHIVE",
  },
  {
    name: "Album of the Year",
    verdict:
      "Great for one thing: aggregated critic + user scores and year-end charts. Reviews and profiles exist but the social features are thin and it's built web-first. Pick it if you mainly want to check scores.",
    label: "THE SCOREBOARD",
  },
  {
    name: "Last.fm",
    verdict:
      "Tracks what you listen to automatically (scrobbling) and shows your stats — but it isn't a rating or review platform at all. Many people run it alongside a review site rather than instead of one.",
    label: "THE TRACKER",
  },
];

export default async function LetterboxdForMusicPage() {
  const appLive = await isAppStoreLive();
  const faqs = getLetterboxdFAQs(appLive);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "Letterboxd for Music", href: "/letterboxd-for-music" },
        ]}
      />
      <FAQSchema items={faqs} />

      <PageHero
        title="THE LETTERBOXD FOR MUSIC"
        sub="Everyone asks the question with those words — here's the honest answer, including what the formula looks like for albums and who else claims the title."
      />

      {/* ===== The answer, first. AI engines and skimmers both read
             exactly this block — direct claim, no throat-clearing. ===== */}
      <section className="panel-xbox p-5 sm:p-6 space-y-3">
        <p className="text-text-primary leading-relaxed text-sm sm:text-base">
          <strong>The short answer: yes, it exists.</strong> Peak Music
          Reviews is a Letterboxd-style social platform built for albums:
          rate anything from 0 to 10.0, write reviews, build lists, pin four
          favorite albums to a themed profile, and follow people whose taste
          you trust. And because music has release nights the way film has
          premieres, it adds what a music Letterboxd should have — live chat
          rooms when albums drop and two-sided debates with votes. It&apos;s
          free, works fully on the web
          {appLive ? (
            <>
              {" "}and on{" "}
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-primary hover:text-accent-glow transition-colors"
              >
                iOS
              </a>
              ,
            </>
          ) : (
            <> — with an iOS app in the works —</>
          )}{" "}
          and ships updates weekly.
        </p>
        <p className="text-text-secondary leading-relaxed text-sm">
          To be clear: Letterboxd is a film platform and has nothing to do
          with us — &ldquo;Letterboxd for music&rdquo; is just how everyone
          asks the question. Below is how the formula maps onto albums, and
          an honest look at the other sites that get named in the same
          breath.
        </p>
      </section>

      {/* ===== The formula, mapped ===== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">The formula, translated to albums</span>
        </div>

        {/* Wide table scrolls inside its own box on phones — the page
            itself must never scroll sideways. */}
        <div className="panel-xbox overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left p-3 pixel-text text-xs uppercase tracking-widest text-text-muted font-normal">
                  The Letterboxd idea
                </th>
                <th className="text-left p-3 pixel-text text-xs uppercase tracking-widest text-accent-glow font-normal">
                  On Peak Music Reviews
                </th>
              </tr>
            </thead>
            <tbody>
              {MAPPING.map((row) => (
                <tr
                  key={row.lb}
                  className="border-b border-border-subtle last:border-0"
                >
                  <td className="p-3 text-text-secondary">{row.lb}</td>
                  {/* Honest-gap rows render muted — the admission is
                      deliberate, so it should read differently too. */}
                  <td
                    className={`p-3 ${row.gap ? "text-text-muted" : "text-text-primary"}`}
                  >
                    {row.peak}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== The other claimants ===== */}
      <div className="divider-glow" />
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">Who else claims the title</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OTHERS.map((o) => (
            <div key={o.name} className="panel-xbox p-5 space-y-3">
              <span className="vhs-label text-sm">{o.label}</span>
              <h3 className="font-[family-name:var(--font-heading)] font-bold text-text-primary">
                {o.name}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {o.verdict}
              </p>
              {o.href && (
                <Link
                  href={o.href}
                  className="inline-block text-sm text-accent-primary hover:text-accent-glow transition-colors"
                >
                  {o.hrefLabel}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== FAQ — visible twin of the FAQSchema JSON-LD (Google
             requires the marked-up questions to be on the page) ===== */}
      <div className="divider-glow" />
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">Questions people ask</span>
        </div>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <details key={faq.question} className="card-y2k p-4 group">
              <summary className="cursor-pointer font-[family-name:var(--font-heading)] font-bold text-sm text-text-primary group-open:text-accent-primary transition-colors">
                {faq.question}
              </summary>
              <p className="text-sm text-text-secondary leading-relaxed mt-3">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="panel-xbox-glow p-6 sm:p-8 text-center space-y-4 relative overflow-hidden">
        <p className="pixel-text text-lg sm:text-xl text-accent-glow">
          Your four favorites are waiting for a profile.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
          <Link href="/signup" className="btn-y2k btn-y2k-primary">
            Create Account
          </Link>
          <Link href="/reviews" className="btn-y2k btn-y2k-outline">
            Browse the Community
          </Link>
        </div>
        <div className="scan-bar" />
      </section>
    </div>
  );
}
