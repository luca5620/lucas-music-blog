import type { Metadata } from "next";
import Link from "next/link";

/**
 * Privacy Policy — required by the App Store (the Privacy Policy URL
 * field is mandatory) and just good practice. Written in plain
 * English on purpose; it describes what the platform actually does,
 * nothing more.
 */

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Peak Music Reviews collects, why, and what it never does.",
};

const LAST_UPDATED = "September 3, 2026";

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      <div className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">PRIVACY POLICY</h1>
        <p className="text-text-muted text-sm">Last updated: {LAST_UPDATED}</p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">The short version</h2>
        <p>
          Peak Music Reviews collects the minimum needed to run a music
          community: your email (to secure your account), the content you
          choose to post, and the images you choose to upload. We don&apos;t
          run ads, we don&apos;t sell data, and we don&apos;t track you across
          other apps or websites.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">What we collect</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-text-primary">Account info:</strong> your
            email address and a password (stored hashed — we never see it),
            plus the username and display name you pick.
          </li>
          <li>
            <strong className="text-text-primary">Content you post:</strong>{" "}
            reviews, ratings, lists, comments, debate votes and messages,
            live-room chat, and profile customization (bio, avatar, banner,
            links, theme).
          </li>
          <li>
            <strong className="text-text-primary">Basic technical data:</strong>{" "}
            standard server logs (IP address, browser type) kept briefly by
            our hosting providers for security and abuse prevention.
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">What we never do</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>No selling or renting your data to anyone.</li>
          <li>No advertising networks or cross-site/app tracking.</li>
          <li>No reading your private info beyond what running the site requires.</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">Who processes your data</h2>
        <p>
          The platform runs on <strong className="text-text-primary">Supabase</strong>{" "}
          (database, authentication, image storage) and{" "}
          <strong className="text-text-primary">Vercel</strong> (hosting). Album,
          artist, and song metadata comes from the Spotify and Genius public
          APIs — your searches are sent to those services to return results,
          without your identity attached.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">What&apos;s public</h2>
        <p>
          Reviews, ratings, lists, comments, debate activity, and your profile
          (username, display name, avatar, banner, bio, showcases) are public
          — that&apos;s the point of the platform. Your email address is never
          shown to anyone.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">Your controls</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Edit or delete your own content at any time.</li>
          <li>Block other users and report content that breaks the rules.</li>
          <li>
            Delete your account yourself at any time — Settings &rarr; Danger
            Zone. Deletion is immediate and removes your account and all your
            content. (You can also contact us below.)
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">Age</h2>
        <p>
          Peak Music Reviews is not directed at children under 13. Don&apos;t
          sign up if you&apos;re under 13.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">If you&apos;re in the EU or UK</h2>
        <p>
          We process your data to provide the service you signed up for
          (your account and the content you post) and, for server logs, to
          keep the platform secure &mdash; that&apos;s our legitimate interest.
          We don&apos;t use your data for anything that would need separate
          consent, and we set no advertising or analytics cookies, only the
          ones needed to keep you signed in.
        </p>
        <p>
          Our providers (Supabase, Vercel) store data in the United States
          under their standard contractual clauses for international
          transfers. We keep your data for as long as your account exists;
          server logs are kept for a short period by the providers and then
          discarded.
        </p>
        <p>
          You can access, correct, or delete your data yourself from
          Settings. For a copy of your data, a correction we don&apos;t
          expose in Settings, or an objection to processing, email us below
          and we&apos;ll respond within 30 days. You also have the right to
          complain to your local data protection authority.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <h2 className="vhs-label text-base">Contact</h2>
        <p>
          Questions or deletion requests:{" "}
          <a
            href="mailto:contact@peakmusicreviews.com"
            className="text-accent-primary hover:text-accent-glow"
          >
            contact@peakmusicreviews.com
          </a>
          . See also our <Link href="/terms" className="text-accent-primary hover:text-accent-glow">Terms of Use</Link>.
        </p>
      </section>
    </div>
  );
}
