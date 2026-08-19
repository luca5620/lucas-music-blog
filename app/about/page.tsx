import type { Metadata } from "next";

/**
 * About page — the story and purpose of Peak Music Reviews.
 *
 * DELIBERATELY A SKELETON: Luca is writing the actual words himself.
 * Every section body below is a placeholder — swap the
 * <SectionPlaceholder /> for real paragraphs when the words are
 * ready (plain <p className="..."> blocks, see the commented example
 * in the first section).
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
        <div className="panel-xbox p-6">
          {/* Luca: replace the placeholder with paragraphs like:
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                Your words here...
              </p>
              (stack several, they space themselves if you wrap them in
              a div with className="space-y-3") */}
          <SectionPlaceholder />
        </div>
      </section>

      {/* ===== THE PURPOSE ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">THE PURPOSE</div>
        <div className="panel-xbox p-6">
          <SectionPlaceholder />
        </div>
      </section>

      {/* ===== WHAT'S NEXT ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">WHAT&apos;S NEXT</div>
        <div className="panel-xbox p-6">
          <SectionPlaceholder />
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

/** The blank-until-Luca-writes-it treatment, styled like the site's
 *  other empty states so the page reads as "tuned but not broadcast
 *  yet" rather than broken. */
function SectionPlaceholder() {
  return (
    <p className="osd-text text-sm opacity-60">
      NO SIGNAL — transmission coming soon.
    </p>
  );
}
