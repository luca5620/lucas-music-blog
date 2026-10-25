"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useWebOnly } from "@/lib/useWebOnly";
import RoleBadge from "@/components/ui/RoleBadge";

/**
 * SupportPanel — the pitch + amount picker on /support (2026-10-25).
 *
 * WEBSITE ONLY. The page already skips this for app builds that carry
 * the PMRBuild user-agent token; useWebOnly covers the oldest binaries
 * without it (and renders nothing on the server either way). In the app it renders nothing at all —
 * no price, no button (Apple 3.1.1 / 3.1.3).
 *
 * Any amount, once (Luca's call): four quick picks plus "other". The
 * button asks our API for a Stripe Checkout link and goes there; the
 * checkmark arrives via the webhook, not from this page.
 */

const PRESETS = [3, 5, 10, 20] as const;
const MIN = 1;
const MAX = 500;

export default function SupportPanel({
  signedIn,
  sinceLabel,
  thanks,
  enabled,
}: {
  signedIn: boolean;
  /** "October 2026" when this member already supports, else null. */
  sinceLabel: string | null;
  /** Back from Stripe with ?thanks=1. */
  thanks: boolean;
  /** Stripe keys are set on the server. */
  enabled: boolean;
}) {
  const t = useTranslations("support");
  const webOnly = useWebOnly();
  const [pick, setPick] = useState<number | "other">(5);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!webOnly) return null;

  const dollars = pick === "other" ? Number(other) : pick;
  const valid = Number.isFinite(dollars) && dollars >= MIN && dollars <= MAX;
  // Whole cents only, so "4.999" can't sneak past as a fraction.
  const cents = valid ? Math.round(dollars * 100) : 0;
  const amountLabel = valid
    ? `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`
    : "";

  async function go() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/support/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: cents }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? t("error"));
        setBusy(false);
        return;
      }
      // Off to Stripe's hosted page (it comes back to /support?thanks=1).
      window.location.href = data.url;
    } catch {
      setError(t("error"));
      setBusy(false);
    }
  }

  return (
    <>
      {thanks && (
        <div className="panel-xbox p-5 text-sm sm:text-base text-text-primary leading-relaxed">
          {t("thanks")}
        </div>
      )}

      {/* ===== WHY ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{t("whyLabel")}</div>
        <div className="panel-xbox p-6">
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">{t("why")}</p>
        </div>
      </section>

      {/* ===== WHAT YOU GET ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{t("getLabel")}</div>
        <div className="panel-xbox p-6 space-y-3">
          <ul className="space-y-2 text-sm sm:text-base text-text-secondary leading-relaxed">
            <li className="flex items-center gap-2">
              <RoleBadge role="supporter" size="sm" />
              <span>{t("get1")}</span>
            </li>
            <li className="pl-1">· {t("get2")}</li>
            <li className="pl-1">· {t("get3")}</li>
          </ul>
          <p className="text-xs text-text-muted">{t("nothingLocked")}</p>
        </div>
      </section>

      {/* ===== PICK AN AMOUNT ===== */}
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{t("amountLabel")}</div>
        <div className="panel-xbox p-6 space-y-4">
          {sinceLabel && (
            <p className="text-sm text-text-primary">{t("already", { since: sinceLabel })}</p>
          )}

          {!enabled ? (
            <p className="text-sm text-text-muted">{t("notYet")}</p>
          ) : !signedIn ? (
            <p className="text-sm text-text-secondary">
              {t("loginFirst")}{" "}
              <Link
                href="/login?next=/support"
                className="text-accent-primary hover:text-accent-glow transition-colors"
              >
                {t("login")}
              </Link>
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPick(p)}
                    aria-pressed={pick === p}
                    className={`btn-y2k ${pick === p ? "btn-y2k-primary" : "btn-y2k-outline"}`}
                  >
                    ${p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPick("other")}
                  aria-pressed={pick === "other"}
                  className={`btn-y2k ${pick === "other" ? "btn-y2k-primary" : "btn-y2k-outline"}`}
                >
                  {t("other")}
                </button>
              </div>

              {pick === "other" && (
                <label className="flex items-center gap-2 max-w-[12rem]">
                  <span className="text-text-secondary">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={MIN}
                    max={MAX}
                    step="0.01"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    placeholder="7"
                    className="form-input text-base"
                    aria-label={t("otherAria")}
                  />
                </label>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={go}
                  disabled={!valid || busy}
                  className="btn-y2k btn-y2k-primary disabled:opacity-50"
                >
                  {busy ? t("opening") : valid ? t("cta", { amount: amountLabel }) : t("ctaPick")}
                </button>
                <p className="text-xs text-text-muted">{t("oneTime")}</p>
                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
