import type { Metadata } from "next";

/**
 * About page — the story and purpose of Peak Music Reviews.
 *
 * Stand-in copy written 2026-08-20 so the page reads as finished
 * (App Review looks at every page). Luca: this is yours to rewrite
 * in your own words whenever you're ready — just edit the <p> blocks.
 */

export const metadata: Metadata = {
  title: "About",
  description:
    "The story and purpose behind Peak Music Reviews — the music social network.",
  alternates: {
    canonical: "https://peakmusicreviews.com/about",
  },
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-8">
      {/* Page header */}
      <header className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">About Us</h1>
        <p className="font-[family-name:var(--font-vt323)] text-lg text-text-secondary">
          What Peak Music Reviews is, and why it exists.
        </p>
      </header>

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

      {/* ===== WHAT'S NEXT ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">WHAT&apos;S NEXT</div>
        <div className="panel-xbox p-6 space-y-3">
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            We&apos;re early, and that&apos;s the fun part. On the bench:
            smarter taste-matching so the For You page gets sharper as
            you rate, richer profiles, more ways to go live around
            release nights, and whatever the first wave of members asks
            for loudest.
          </p>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            If you&apos;re reading this, you&apos;re early too. Rate
            something.
          </p>
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
