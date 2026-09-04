import type { Metadata } from "next";
import Link from "next/link";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
// The FAQSchema JSON-LD keeps the English aboutFAQs (SEO is English); the
// visible FAQ renders the translated twins from messages (about.faq.*).
import { useTranslations } from "next-intl";
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

// Each fact is a label + value pair in messages: about.facts.<key> and
// about.facts.<key>V.
const FACT_KEYS = ["what", "price", "where", "scale", "catalog", "live"] as const;
const ABOUT_FAQ_KEYS = [1, 2, 3, 4, 5, 6] as const;

export default function AboutPage() {
  const t = useTranslations("about");
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
        <h1 className="crt-title text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="font-[family-name:var(--font-vt323)] text-lg text-text-secondary">
          {t("sub")}
        </p>
      </header>

      {/* ===== ANSWER FIRST ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{t("inOneBreath")}</div>
        <div className="panel-xbox p-6 space-y-4">
          <p className="text-sm sm:text-base text-text-primary leading-relaxed">
            {t.rich("intro", { strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {FACT_KEYS.map((k) => (
              <div key={k} className="flex gap-3 text-sm">
                <dt className="pixel-text text-[11px] uppercase tracking-widest text-text-muted w-16 shrink-0 pt-0.5">
                  {t(`facts.${k}`)}
                </dt>
                <dd className="text-text-secondary">{t(`facts.${k}V`)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/signup" className="btn-y2k btn-y2k-primary">
              {t("joinFree")}
            </Link>
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-y2k btn-y2k-outline"
            >
              {t("iosApp")}
            </a>
          </div>
        </div>
      </section>

      {/* ===== THE STORY ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{t("theStory")}</div>
        <div className="panel-xbox p-6 space-y-3">
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            {t("story1")}
          </p>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            {t("story2")}
          </p>
        </div>
      </section>

      {/* ===== THE PURPOSE ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{t("thePurpose")}</div>
        <div className="panel-xbox p-6 space-y-3">
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            {t("purpose1")}
          </p>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            {t("purpose2")}
          </p>
        </div>
      </section>

      {/* ===== WHAT'S DIFFERENT ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{t("whatsDifferent")}</div>
        <div className="panel-xbox p-6">
          <ul className="space-y-2 text-sm sm:text-base text-text-secondary leading-relaxed list-disc pl-5">
            <li>
              <strong className="text-text-primary">{t("diff1H")}</strong>{" "}
              {t("diff1B")}
            </li>
            <li>
              <strong className="text-text-primary">{t("diff2H")}</strong>{" "}
              {t("diff2B")}
            </li>
            <li>
              <strong className="text-text-primary">{t("diff3H")}</strong>{" "}
              {t("diff3B")}
            </li>
            <li>
              <strong className="text-text-primary">{t("diff4H")}</strong>{" "}
              {t("diff4B")}
            </li>
          </ul>
        </div>
      </section>

      {/* ===== FAQ (visible twin of the JSON-LD above) ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{t("questions")}</div>
        <div className="panel-xbox p-2 divide-y divide-white/5">
          {ABOUT_FAQ_KEYS.map((k) => (
            <details key={k} className="group p-4">
              <summary className="cursor-pointer list-none flex items-start justify-between gap-3 font-[family-name:var(--font-heading)] font-bold text-text-primary">
                <span>{t(`faq.q${k}`)}</span>
                <span className="text-text-muted group-open:rotate-45 transition-transform shrink-0">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                {t(`faq.a${k}`)}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ===== CONTACT (already real — the working inbox) ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{t("getInTouch")}</div>
        <div className="panel-xbox p-6">
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            {t("contact")}{" "}
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
