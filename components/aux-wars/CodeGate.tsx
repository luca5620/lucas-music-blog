"use client";

/**
 * CodeGate — the door of a PRIVATE Aux War room. Six letters from
 * the host, checked by /api/aux-wars/join (aux_join_with_code
 * writes the viewer row that unlocks the room), then a refresh so
 * the server page renders the room. Signed-out visitors get the
 * sign-in button instead — a code without an account can't be
 * remembered.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

export default function CodeGate({ slug }: { slug: string }) {
  const t = useTranslations("aux.gate");
  const router = useRouter();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || code.trim().length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/aux-wars/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, code: code.trim().toUpperCase() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("wrong"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("wrong"));
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto panel-xbox-glow p-6 sm:p-8 space-y-4 text-center relative overflow-hidden">
      <span className="osd-text text-xs">{t("private")}</span>
      <h1 className="crt-title text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="text-sm text-text-secondary">{t("sub")}</p>
      {user ? (
        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder={t("placeholder")}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="form-input text-center tracking-[0.5em] text-xl font-[family-name:var(--font-vt323)] uppercase"
            autoFocus
          />
          {error && <p className="text-xs text-accent-rose">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="btn-y2k btn-y2k-primary w-full disabled:opacity-50"
          >
            {busy ? t("entering") : t("enter")}
          </button>
        </form>
      ) : (
        <Link href={`/login?next=/aux-wars/${slug}`} className="btn-y2k btn-y2k-primary inline-block">
          {t("signIn")}
        </Link>
      )}
      <div className="scan-bar" />
    </div>
  );
}
