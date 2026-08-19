/**
 * SiteFooter — one quiet line at the bottom of every page.
 *
 * Now that contact@peakmusicreviews.com actually forwards somewhere
 * (ImprovMX, 2026-08-19), every page invites bug reports. Small on
 * purpose: it's a service hatch, not a section.
 */
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-12 pt-4 border-t border-border-subtle">
      <p className="font-[family-name:var(--font-vt323)] text-sm text-text-muted text-center">
        Found a problem?{" "}
        <a
          href="mailto:contact@peakmusicreviews.com"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          contact@peakmusicreviews.com
        </a>
      </p>
      <p className="font-[family-name:var(--font-vt323)] text-sm text-text-muted text-center mt-1">
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
      </p>
    </footer>
  );
}
