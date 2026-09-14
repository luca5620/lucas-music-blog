"use client";

/**
 * SeatGate — the six letters, asked for INSIDE a private room rather
 * than in front of it (Luca 2026-09-14: "the room that is private is
 * restricted to only the players with the code to PARTICIPATE").
 *
 * A private room is open to watch, vote, react and chat. The code
 * buys one thing: a seat in the bracket. So this is a small line in
 * the lobby, not a wall — CodeGate is still the wall, and it only
 * stands in front of a room the host also marked HIDDEN.
 *
 * Same endpoint as the gate (aux_join_with_code), which writes the
 * seat; on success the lobby re-renders with "grab a spot" in place
 * of this.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";

export default function SeatGate({
  slug,
  onSeated,
}: {
  slug: string;
  onSeated: () => void;
}) {
  const t = useTranslations("aux.seat");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || code.trim().length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/aux-battles/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, code: code.trim().toUpperCase() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("wrong"));
      onSeated();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("wrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-osd-amber/30 bg-osd-amber/5 p-3 space-y-2">
      <p className="text-xs text-text-secondary">{t("watchOnly")}</p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-y2k btn-y2k-outline !py-1 !px-3 !text-xs"
        >
          {t("haveCode")}
        </button>
      ) : (
        <form onSubmit={submit} className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder={t("placeholder")}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            aria-label={t("placeholder")}
            className="form-input !py-1.5 w-32 font-[family-name:var(--font-vt323)] text-xl tracking-[0.3em] text-center"
          />
          <button
            type="submit"
            disabled={busy || code.trim().length !== 6}
            className="btn-y2k btn-y2k-primary !py-1.5 !px-3 !text-xs disabled:opacity-40"
          >
            {busy ? t("checking") : t("enter")}
          </button>
        </form>
      )}
      {error && <p className="text-xs text-accent-rose">{error}</p>}
    </div>
  );
}
