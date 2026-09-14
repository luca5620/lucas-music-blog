"use client";

/**
 * DeleteRoomButton — the host tears an aux battle room down (DELETE
 * /api/aux-battles/[roomId]; bracket, votes and chat cascade). Inline
 * yes/no confirm, same shape as the list/post delete buttons. Used on
 * /reviews/mine (My Stuff); the room page itself has END instead.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";

export default function DeleteRoomButton({ roomId, name }: { roomId: string; name: string }) {
  const t = useTranslations("aux.room");
  const tc = useTranslations("common");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/aux-battles/${roomId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("deleteFailed"));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("deleteFailed"));
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-secondary">{t("deleteConfirm", { name })}</span>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-accent-rose/15 text-accent-rose border border-accent-rose/40 hover:bg-accent-rose/25 transition-colors font-[family-name:var(--font-heading)] disabled:opacity-50"
        >
          {busy ? t("deleting") : tc("yes")}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors font-[family-name:var(--font-heading)]"
        >
          {tc("no")}
        </button>
        {error && <span className="text-xs text-accent-rose">{error}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-accent-rose hover:bg-accent-rose/10 transition-colors font-[family-name:var(--font-heading)]"
    >
      ✕ {t("deleteRoom")}
    </button>
  );
}
