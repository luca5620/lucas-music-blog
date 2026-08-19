import type { Metadata } from "next";
import Link from "next/link";

/**
 * Terms of Use — plain-English house rules. Apple's UGC guideline
 * (1.2) expects published rules users agree to; these are them.
 */

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The house rules for Peak Music Reviews.",
};

const LAST_UPDATED = "August 18, 2026";

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      <div className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">TERMS OF USE</h1>
        <p className="text-text-muted text-sm">Last updated: {LAST_UPDATED}</p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">The deal</h2>
        <p>
          Peak Music Reviews is a free music community. By creating an account
          or using the site or apps, you agree to these terms and to the{" "}
          <Link href="/privacy" className="text-accent-primary hover:text-accent-glow">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">House rules</h2>
        <p>Strong opinions about music are the point. These aren&apos;t:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>No harassment, hate speech, threats, or targeting people rather than takes.</li>
          <li>No spam, scams, or flooding feeds, rooms, or debates.</li>
          <li>No sexually explicit content or shock content.</li>
          <li>No impersonating other people or artists.</li>
          <li>No posting other people&apos;s private information.</li>
          <li>
            No uploading audio files or linking piracy — the catalog is
            metadata and artwork only.
          </li>
        </ul>
        <p>
          Content that breaks the rules can be removed and accounts that keep
          breaking them can be suspended or banned, at the moderators&apos;
          judgment. There is zero tolerance for objectionable content and
          abusive users: use the <strong className="text-text-primary">report</strong>{" "}
          button on any content, and <strong className="text-text-primary">block</strong>{" "}
          any user from their profile. Reports are reviewed and acted on
          within 24 hours.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">Your content</h2>
        <p>
          You own what you write. By posting it you give Peak Music Reviews
          permission to display and distribute it on the platform (that&apos;s
          what posting is). You can edit or delete your content whenever you
          want. Don&apos;t post anything you don&apos;t have the right to post.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">Accounts</h2>
        <p>
          One account per person, real email required. You&apos;re responsible
          for what happens on your account. We may reclaim usernames that
          impersonate others or squat on artist names.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">The service</h2>
        <p>
          Provided as-is, no uptime guarantees — it&apos;s a community
          platform, not a bank. Features may change. Album metadata and
          artwork come from third-party catalogs (Spotify, Genius) and belong
          to their respective owners; ratings shown are community opinions.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">Contact</h2>
        <p>
          Questions, appeals, takedowns:{" "}
          <a
            href="mailto:contact@peakmusicreviews.com"
            className="text-accent-primary hover:text-accent-glow"
          >
            contact@peakmusicreviews.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
