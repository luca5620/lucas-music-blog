/**
 * /musicboard-alternative — the switcher landing page.
 *
 * Why this page exists (SEO sprint, 2026-08-24): Musicboard — the
 * only real app-first competitor — is visibly failing (TechCrunch,
 * Feb 2026: multi-day outages, Android app pulled from Google Play,
 * no iOS update since May 2025). Its displaced community is searching
 * "musicboard alternative" / "is musicboard shutting down", and that
 * SERP is nothing but thin aggregator sites. This page is the honest,
 * factual answer — and the funnel into Peak.
 *
 * Content rules (they ARE the strategy — keep them on edits):
 *  - Answer-first: the direct answer lives in the first ~100 words,
 *    with hard dates. AI engines (ChatGPT/Perplexity/AI Overviews)
 *    quote exactly that kind of opening.
 *  - Facts stay attributed and dated ("as of August 2026", TechCrunch
 *    link). Never trash-talk beyond what is reported — credibility is
 *    the whole play. Update the dates if the story changes.
 *  - The competitor table includes options we DON'T win (RYM/AOTY
 *    depth) — an honest comparison ranks and gets cited; an ad
 *    does not.
 *  - No promises we haven't shipped: there is NO Musicboard importer
 *    yet, so the page says exactly that.
 */

import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import FAQSchema from "@/components/seo/FAQSchema";
import { BreadcrumbSchema } from "@/app/schema";
import { getMusicboardFAQs } from "@/lib/faq-data";
/* Shared App Store state (lib/app-store.ts) — same listing as the
   home-page badge; isAppStoreLive() auto-flips claims on approval. */
import { APP_STORE_URL, isAppStoreLive } from "@/lib/app-store";

export const metadata: Metadata = {
  title: "Musicboard Alternative — what to switch to in 2026",
  description:
    "Musicboard hasn't updated its iOS app since May 2025 and its Android app is gone from Google Play. Peak Music Reviews is the free, actively-built alternative: 0–10 album ratings, reviews, lists, live release rooms and debates — on web and iOS.",
  alternates: {
    canonical: "https://peakmusicreviews.com/musicboard-alternative",
  },
  openGraph: {
    type: "article",
    url: "https://peakmusicreviews.com/musicboard-alternative",
    title: "Musicboard Alternative — what to switch to in 2026",
    description:
      "An honest comparison for Musicboard users looking for a new home: Peak Music Reviews vs Musicboard, RateYourMusic, and Album of the Year.",
  },
};

/* ─────────────── Comparison data ───────────────
   One row per thing switchers actually compare. Kept as data so
   adding a row is a one-liner and the table markup stays clean.
   `peak` / `mb` cells: string = plain text, true = yes-check,
   false = no-cross. */
type Cell = string | boolean;
/** Built per-request so the iOS row reflects the real App Store state. */
function buildComparison(appLive: boolean): { feature: string; peak: Cell; mb: Cell }[] {
  return [
    { feature: "Album ratings", peak: "0–10.0, one decimal", mb: "Half-star scale" },
    { feature: "Written reviews", peak: true, mb: true },
    { feature: "Lists", peak: true, mb: true },
    { feature: "Live release-night chat rooms", peak: true, mb: false },
    { feature: "Two-sided debates with votes", peak: true, mb: false },
    { feature: "Posts + For You feed", peak: true, mb: false },
    { feature: "Unreleased / leaked tracks in catalog", peak: "Via Genius deep library", mb: false },
    { feature: "Profile customization", peak: "Themes, showcases, favorites", mb: "Basic" },
    { feature: "Full web app", peak: true, mb: "Limited — app-first" },
    { feature: "iOS app", peak: appLive ? "On the App Store" : "Work in progress", mb: "Last updated May 2025" },
    { feature: "Android", peak: "Future release coming soon", mb: "Removed from Google Play" },
    { feature: "Price", peak: "Core free — patron perks planned", mb: "Free + Pro subscription" },
    { feature: "Actively developed", peak: "Updates ship weekly", mb: "No updates since May 2025" },
  ];
}

/** Render a comparison cell: strings verbatim, booleans as ✓/✕. */
function CellValue({ value, accent }: { value: Cell; accent?: boolean }) {
  if (value === true)
    return <span className="text-accent-glow font-bold">✓</span>;
  if (value === false) return <span className="text-text-muted">✕</span>;
  return (
    <span className={accent ? "text-text-primary" : "text-text-secondary"}>
      {value}
    </span>
  );
}

/* ─────────────── The other alternatives ───────────────
   Honest mini-verdicts — including where they beat us. */
const OTHERS = [
  {
    name: "RateYourMusic",
    verdict:
      "The deepest ratings database and genre charts on the internet, built over two decades. But it's web-only, the interface hasn't meaningfully changed in years, and there's no app and no real social layer. Pick it if you want an encyclopedia, not a community.",
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

export default async function MusicboardAlternativePage() {
  const appLive = await isAppStoreLive();
  const faqs = getMusicboardFAQs(appLive);
  const comparison = buildComparison(appLive);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "Musicboard Alternative", href: "/musicboard-alternative" },
        ]}
      />
      <FAQSchema items={faqs} />

      <PageHero
        title="MUSICBOARD ALTERNATIVE"
        sub="Looking for a new home for your ratings? Here's the honest state of the options in 2026 — including the ones that aren't us."
      />

      {/* ===== The answer, first. AI engines and skimmers both read
             exactly this block — hard dates, direct claim. ===== */}
      <section className="panel-xbox p-5 sm:p-6 space-y-3">
        <p className="text-text-primary leading-relaxed text-sm sm:text-base">
          <strong>The short answer:</strong> Peak Music Reviews is the closest
          like-for-like Musicboard replacement — album ratings on a 0–10.0
          scale, written reviews, lists, and social profiles — and it adds
          what Musicboard never had: live release-night chat rooms, two-sided
          debates, a For You feed, and a catalog that includes unreleased
          tracks. It&apos;s free, works fully on the web
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
          As for Musicboard itself: as of August 2026 its iOS app hasn&apos;t
          been updated since May 2025, its Android app is no longer on Google
          Play, and{" "}
          <a
            href="https://techcrunch.com/2026/02/09/so-whats-going-on-with-musicboard/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-primary hover:text-accent-glow transition-colors"
          >
            TechCrunch reported
          </a>{" "}
          repeated multi-day outages with no communication from its founders.
          Nothing official says it&apos;s shutting down — but its community
          has been openly organizing for a way out.
        </p>
      </section>

      {/* ===== Head-to-head table ===== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">Peak Music Reviews vs Musicboard</span>
        </div>

        {/* Wide table scrolls inside its own box on phones — the page
            itself must never scroll sideways. */}
        <div className="panel-xbox overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left p-3 pixel-text text-xs uppercase tracking-widest text-text-muted font-normal">
                  Feature
                </th>
                <th className="text-left p-3 pixel-text text-xs uppercase tracking-widest text-accent-glow font-normal">
                  Peak Music Reviews
                </th>
                <th className="text-left p-3 pixel-text text-xs uppercase tracking-widest text-text-muted font-normal">
                  Musicboard
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr
                  key={row.feature}
                  className="border-b border-border-subtle last:border-0"
                >
                  <td className="p-3 text-text-secondary">{row.feature}</td>
                  <td className="p-3">
                    <CellValue value={row.peak} accent />
                  </td>
                  <td className="p-3">
                    <CellValue value={row.mb} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
          Musicboard details as reported / observed August 2026 — corrections
          welcome at contact@peakmusicreviews.com
        </p>
      </section>

      {/* ===== Switching guide ===== */}
      <div className="divider-glow" />
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">Moving your ratings over</span>
        </div>
        <div className="card-y2k p-5 space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>
            Straight truth: Musicboard has no public data export, so there&apos;s
            no automatic importer — from us or anyone else. Rebuilding by hand
            is faster than it sounds:
          </p>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <Link href="/signup" className="text-accent-primary hover:text-accent-glow transition-colors">
                Create a free account
              </Link>{" "}
              — username, email, done.
            </li>
            <li>
              Search any album — the catalog covers everything on Spotify plus
              Genius deep cuts (yes, unreleased tracks) — and rate it in two
              taps. Your top 50 takes maybe ten minutes.
            </li>
            <li>
              Pin your four favorites to your profile, pick a theme, and
              you&apos;re home.
            </li>
          </ol>
          <p>
            If enough switchers want a proper import tool, we&apos;ll build one —
            say so at{" "}
            <a
              href="mailto:contact@peakmusicreviews.com"
              className="text-accent-primary hover:text-accent-glow transition-colors"
            >
              contact@peakmusicreviews.com
            </a>
            .
          </p>
        </div>
      </section>

      {/* ===== The honest field guide to everything else ===== */}
      <div className="divider-glow" />
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">The other options, honestly</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {OTHERS.map((o) => (
            <div key={o.name} className="panel-xbox p-5 space-y-3">
              <span className="vhs-label text-sm">{o.label}</span>
              <h3 className="font-[family-name:var(--font-heading)] font-bold text-text-primary">
                {o.name}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {o.verdict}
              </p>
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
          <span className="label-xbox">Questions switchers ask</span>
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
          Your taste deserves a platform that&apos;s still being built.
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
