import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { getSupporterSince, getSupporterWall } from "@/lib/db/supporters";
import { stripeConfigured } from "@/lib/stripe";
import UserLink from "@/components/ui/UserLink";
import RoleBadge from "@/components/ui/RoleBadge";
import SupportPanel from "@/components/support/SupportPanel";

/**
 * /support — Support Peak Music (2026-10-25).
 *
 * Luca's plan: support on the WEBSITE, any amount, once = the silver
 * supporter checkmark forever + a spot on the wall below. Payments go
 * through Stripe Checkout (lib/stripe.ts → /api/support/checkout); the
 * badge is granted by the signed webhook (/api/stripe/webhook →
 * record_supporter, migration 061). Nothing functional is sold.
 *
 * IN THE APP this page is ONLY the supporters wall — no price, no
 * button, no "support" pitch (Apple 3.1.1 / 3.1.3: no buying outside
 * Apple's in-app purchase, and no calls to action pointing there). Two
 * checks, belt and braces:
 *   1. server: the shell appends "PMRBuild/<n>" to its user agent
 *      (capacitor.config.ts), so the pitch is never even sent;
 *   2. client: SupportPanel also bails on isNativeApp(), for the
 *      oldest binaries that predate that token.
 */

export const metadata: Metadata = {
  title: "Support Peak Music",
  description:
    "Peak Music Reviews is free, ad-free and made by one person. Support it with any amount and get the silver supporter checkmark for good.",
  alternates: { canonical: "https://peakmusicreviews.com/support" },
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ thanks?: string }>;
}) {
  const [{ thanks }, t, locale, user, wall, hdrs] = await Promise.all([
    searchParams,
    getTranslations("support"),
    getLocale(),
    getUser(),
    getSupporterWall(),
    headers(),
  ]);
  const inApp = /\bPMRBuild\/\d+\b/.test(hdrs.get("user-agent") ?? "");
  const since = user ? await getSupporterSince(user.id) : null;
  const sinceLabel = since
    ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(since))
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-8">
      <header className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">
          {inApp ? t("wallTitle") : t("title")}
        </h1>
        {!inApp && (
          <p className="font-[family-name:var(--font-vt323)] text-lg text-text-secondary">
            {t("sub")}
          </p>
        )}
      </header>

      {!inApp && (
        <SupportPanel
          signedIn={!!user}
          sinceLabel={sinceLabel}
          thanks={thanks === "1"}
          enabled={stripeConfigured()}
        />
      )}

      {/* ===== THE WALL — the one part the app shows too ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{t("wallLabel")}</div>
        <div className="panel-xbox p-6">
          {wall.length === 0 ? (
            <p className="text-sm text-text-muted">
              {inApp ? t("wallEmptyApp") : t("wallEmpty")}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {wall.map(({ profile }) => (
                <li key={profile.id} className="inline-flex items-center gap-1.5 text-sm">
                  <UserLink
                    username={profile.username}
                    className="text-text-primary hover:text-accent-primary transition-colors"
                  >
                    {profile.display_name || profile.username}
                  </UserLink>
                  {/* Their OWN badge: staff keep theirs (061 only turns
                      plain members silver), everyone else is silver. */}
                  <RoleBadge
                    role={profile.role === "user" ? "supporter" : profile.role}
                    size="xs"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {!inApp && (
        <p className="text-xs text-text-muted leading-relaxed">
          {t("finePrint")}{" "}
          <Link href="/terms" className="underline hover:text-accent-primary">
            {t("terms")}
          </Link>
        </p>
      )}
    </div>
  );
}
