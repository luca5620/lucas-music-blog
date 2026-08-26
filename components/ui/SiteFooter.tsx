/**
 * SiteFooter — one quiet line at the bottom of every page.
 *
 * Now that contact@peakmusicreviews.com actually forwards somewhere
 * (ImprovMX, 2026-08-19), every page invites bug reports. Small on
 * purpose: it's a service hatch, not a section.
 */
import Link from "next/link";
import PressTapTarget from "@/components/ui/PressTapTarget";

export default function SiteFooter() {
  return (
    <footer className="mt-12 pt-4 border-t border-border-subtle">
      <p className="font-[family-name:var(--font-vt323)] text-sm text-text-muted text-center">
        {/* 5 quick taps on this text = press mode (screenshot blur) —
            the app shell has no URL bar for ?press=1 */}
        <PressTapTarget>Found a problem?</PressTapTarget>{" "}
        <a
          href="mailto:contact@peakmusicreviews.com"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          contact@peakmusicreviews.com
        </a>
      </p>
      <p className="font-[family-name:var(--font-vt323)] text-sm text-text-muted text-center mt-1">
        {/* About lives here so it's reachable from EVERY page — the
            dashboard's About button only exists when signed in, which
            read as "the button disappeared" to logged-out visitors. */}
        <Link
          href="/about"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          About Us
        </Link>
        {" · "}
        <Link
          href="/privacy"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          Privacy Policy
        </Link>
        {" · "}
        <Link
          href="/terms"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          Terms of Use
        </Link>
        {" · "}
        {/* Switcher landing page — footer link on every page gives it
            crawlable internal linking (it's in no nav menu). */}
        <Link
          href="/musicboard-alternative"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          Switching from Musicboard?
        </Link>
        {" · "}
        {/* Second SEO landing page — same crawlable-from-everywhere
            reasoning as the Musicboard link above. */}
        <Link
          href="/letterboxd-for-music"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          The Letterboxd for music
        </Link>
      </p>
    </footer>
  );
}
