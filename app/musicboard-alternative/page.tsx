/**
 * /musicboard-alternative — the switcher landing page.
 *
 * Why this page exists (SEO sprint, 2026-08-24): Musicboard — the
 * only real app-first competitor — has stalled (TechCrunch, Feb 2026:
 * multi-day outages; Android app not on Google Play; no iOS update
 * since May 2025). Its users are searching "musicboard alternative" /
 * "is musicboard shutting down", and that SERP is nothing but thin
 * aggregator sites. This page is the honest, factual answer — and the
 * funnel into Peak.
 *
 * Content rules (they ARE the strategy — keep them on edits):
 *  - Answer-first: the direct answer lives in the first ~100 words,
 *    with hard dates. AI engines (ChatGPT/Perplexity/AI Overviews)
 *    quote exactly that kind of opening.
 *  - Facts stay attributed and dated ("as of August 2026", TechCrunch
 *    link). Never trash-talk — state what is reported, neutrally, and
 *    no more (toned down 2026-09-03 on Luca's ask: no "failing", no
 *    "never had", no "way out"). Credibility is the whole play. Update
 *    the dates if the story changes.
 *  - Table must FIT a phone: .panel-xbox is overflow:hidden (unlayered,
 *    so it beats Tailwind's overflow-x-auto) — a min-width table just
 *    gets clipped. Fixed column widths + wrapping, no side-scroll.
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
    "Looking for a Musicboard alternative? Peak Music Reviews is a free, actively-built option: 0–10 album ratings, reviews, lists, live release rooms and debates — on web and iOS. An honest comparison, including the options that aren't us.",
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
    { feature: "Full web app", peak: true, mb: "App-first" },
    { feature: "iOS app", peak: appLive ? "On the App Store" : "Work in progress", mb: "Last update May 2025" },
    { feature: "Android", peak: "Planned", mb: "Not currently on Google Play" },
    { feature: "Price", peak: "Core free — patron perks planned", mb: "Free + Pro subscription" },
    { feature: "Update cadence", peak: "Weekly", mb: "Paused since May 2025" },
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
      "The deepest ratings database and genre charts on the internet, built over two decades, with a community of serious listeners to match. It's web-only with no app, and it's built around cataloguing rather than feeds and conversation. A great choice if depth of data is what you value most.",
    label: "THE ARCHIVE",
  },
  {
    name: "Album of the Year",
    verdict:
      "The best place for aggregated critic and user scores and year-end charts. Reviews and profiles are there too, with a lighter social layer, and it's built web-first. A great choice if you mainly want to check and compare scores.",
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
          scale, written reviews, lists, and social profiles — plus a few
          things Musicboard doesn&apos;t offer: live release-night chat rooms,
          two-sided debates, a For You feed, and a catalog that includes
          unreleased tracks. It&apos;s free, works fully on the web
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
          been updated since May 2025, its Android app isn&apos;t currently on
          Google Play, and{" "}
          <a
            href="https://techcrunch.com/2026/02/09/so-whats-going-on-with-musicboard/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-primary hover:text-accent-glow transition-colors"
          >
            TechCrunch reported
          </a>{" "}
          a stretch of multi-day outages earlier this year. Nothing official
          says it&apos;s shutting down, and it may well pick back up — but
          plenty of its users are looking for a second home in the meantime.
        </p>
      </section>

      {/* ===== Head-to-head table ===== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">Peak Music Reviews vs Musicboard</span>
        </div>

        {/* Fits the phone: fixed column widths, text wraps. No
            min-width — the panel clips instead of scrolling. */}
        <div className="panel-xbox">
          <table className="w-full table-fixed text-xs sm:text-sm">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[32%]" />
              <col className="w-[32%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left p-2 sm:p-3 pixel-text text-[10px] sm:text-xs uppercase tracking-widest text-text-muted font-normal">
                  Feature
                </th>
                <th className="text-left p-2 sm:p-3 pixel-text text-[10px] sm:text-xs uppercase tracking-widest text-accent-glow font-normal">
                  Peak
                </th>
                <th className="text-left p-2 sm:p-3 pixel-text text-[10px] sm:text-xs uppercase tracking-widest text-text-muted font-normal">
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
                  <td className="p-2 sm:p-3 align-top text-text-secondary break-words">{row.feature}</td>
                  <td className="p-2 sm:p-3 align-top break-words">
                    <CellValue value={row.peak} accent />
                  </td>
                  <td className="p-2 sm:p-3 align-top break-words">
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
            Musicboard doesn&apos;t offer a public data export, so there&apos;s
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
          Bring your taste. We&apos;re just getting started.
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
