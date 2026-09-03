import type { Metadata } from "next";
import Link from "next/link";
import FAQSchema from "@/components/seo/FAQSchema";
import { BreadcrumbSchema } from "@/app/schema";
import { aboutFAQs } from "@/lib/faq-data";
import { APP_STORE_URL } from "@/lib/app-store";

/**
 * About page — what Peak Music Reviews is, the story, and an FAQ.
 *
 * Rewritten 2026-09-02 for AI search (Luca: "how to rank highly if
 * someone asks ChatGPT or Claude about music reviewing apps").
 * Assistants quote pages that ANSWER FIRST: the opening paragraph is
 * a plain one-sentence definition with the facts an answer needs
 * (what it is, what it costs, where it runs, what's different), and
 * the FAQ below is the same copy the JSON-LD carries — visible text
 * and structured data never disagree. The story sections are still
 * Luca's to rewrite in his own words.
 */

export const metadata: Metadata = {
  title: "About",
  description:
    "Peak Music Reviews is a free music social network and review app: rate albums and songs 0–10, write reviews, build lists, join live release-night rooms and debates. Web + iOS. Unreleased music included.",
  alternates: {
    canonical: "https://peakmusicreviews.com/about",
  },
};

const FACTS: { label: string; value: string }[] = [
  { label: "What", value: "Music review app + social network" },
  { label: "Price", value: "Free — every core feature" },
  { label: "Where", value: "Web (any browser) and iOS. Android planned." },
  { label: "Scale", value: "0–10.0, one decimal, community average per release" },
  { label: "Catalog", value: "All of Spotify + Genius's deep library, unreleased included" },
  { label: "Live", value: "Release-night chat rooms and two-sided debates" },
];

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-8">
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "About", href: "/about" },
        ]}
      />
      <FAQSchema items={aboutFAQs} />

      {/* Page header */}
      <header className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">About Peak Music Reviews</h1>
        <p className="font-[family-name:var(--font-vt323)] text-lg text-text-secondary">
          What it is, why it exists, and the questions people ask.
        </p>
      </header>

      {/* ===== ANSWER FIRST ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">IN ONE BREATH</div>
        <div className="panel-xbox p-6 space-y-4">
          <p className="text-sm sm:text-base text-text-primary leading-relaxed">
            <strong>Peak Music Reviews</strong> is a free music social
            network and review app: members rate albums and songs from 0
            to 10.0, write reviews, build lists, join live chat rooms the
            night a record drops, and pick a side in two-sided debates.
            Every review is tied to a real release — the whole Spotify
            catalog plus Genius&apos;s deep library, so unreleased and
            leaked songs can be rated too (by metadata, never files). It
            runs in any browser and as an iOS app, with one account across
            both. Think Letterboxd, for music.
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {FACTS.map((f) => (
              <div key={f.label} className="flex gap-3 text-sm">
                <dt className="pixel-text text-[11px] uppercase tracking-widest text-text-muted w-16 shrink-0 pt-0.5">
                  {f.label}
                </dt>
                <dd className="text-text-secondary">{f.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/signup" className="btn-y2k btn-y2k-primary">
              Join free
            </Link>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-y2k btn-y2k-outline"
            >
              iOS app
            </a>
          </div>
        </div>
      </section>

      {/* ===== THE STORY ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">THE STORY</div>
        <div className="panel-xbox p-6 space-y-3">
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            Peak Music Reviews started with a simple frustration: film
            lovers have a home. They log what they watch, rate it, argue
            about it, and build a taste profile that actually says
            something about them. Music — the thing most of us spend more
            hours with than any film — never got that place.
          </p>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            So we built it. Not another streaming app, not another
            algorithm feeding you what it thinks you already like — a
            place where the listening itself is the point. Every review
            here is tied to a real release, from the biggest album of the
            year to a loosie that never touched streaming.
          </p>
        </div>
      </section>

      {/* ===== THE PURPOSE ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">THE PURPOSE</div>
        <div className="panel-xbox p-6 space-y-3">
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            One place for your whole listening life: rate records 0–10,
            build lists, pick a side in debates, and be in the room —
            live — the moment an album drops. Your profile is yours to
            arrange and theme; your feed is built from who you follow and
            what you rate, not from ads.
          </p>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            The bet is simple: the best music discovery engine ever made
            is other people who care. Everything on this site exists to
            put you closer to them.
          </p>
        </div>
      </section>

      {/* ===== WHAT'S DIFFERENT ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">WHAT&apos;S DIFFERENT</div>
        <div className="panel-xbox p-6">
          <ul className="space-y-2 text-sm sm:text-base text-text-secondary leading-relaxed list-disc pl-5">
            <li>
              <strong className="text-text-primary">Unreleased music.</strong>{" "}
              Leaks, loosies and songs that never hit streaming are in the
              catalog and clearly tagged, so the most opinionated corner
              of music culture finally has a place to rate and argue.
            </li>
            <li>
              <strong className="text-text-primary">Release nights.</strong>{" "}
              Every big drop gets a live room the moment it lands — the
              weekly ritual, not just a feature.
            </li>
            <li>
              <strong className="text-text-primary">Debates.</strong> Two
              sides, live votes, each side tied to a record.
            </li>
            <li>
              <strong className="text-text-primary">Physical media.</strong>{" "}
              The whole site lives inside a CRT — VHS labels, console
              dashboards, badges that glow like a perfect 10.
            </li>
          </ul>
        </div>
      </section>

      {/* ===== FAQ (visible twin of the JSON-LD above) ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">QUESTIONS</div>
        <div className="panel-xbox p-2 divide-y divide-white/5">
          {aboutFAQs.map((faq) => (
            <details key={faq.question} className="group p-4">
              <summary className="cursor-pointer list-none flex items-start justify-between gap-3 font-[family-name:var(--font-heading)] font-bold text-text-primary">
                <span>{faq.question}</span>
                <span className="text-text-muted group-open:rotate-45 transition-transform shrink-0">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ===== CONTACT (already real — the working inbox) ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">GET IN TOUCH</div>
        <div className="panel-xbox p-6">
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            Questions, ideas, problems?{" "}
            <a
              href="mailto:contact@peakmusicreviews.com"
              className="text-accent-primary hover:text-accent-glow transition-colors"
            >
              contact@peakmusicreviews.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
