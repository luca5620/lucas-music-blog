"use client";

/**
 * SotdPicker — set (or change) today's Song of the Day.
 * Same two-step catalog flow as the profile song: search a release,
 * then tap the track. POSTs to /api/sotd and refreshes the profile
 * so the new pick + streak flame render server-side.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import CatalogSearch, {
  type CatalogPick,
} from "@/components/catalog/CatalogSearch";
import { useTranslations } from "next-intl";

interface SotdPickerProps {
  /** True when a pick already exists today (button says "change"). */
  hasToday: boolean;
}

export default function SotdPicker({ hasToday }: SotdPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(!hasToday);
  const [pick, setPick] = useState<CatalogPick | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("profile.sotd");

  async function chooseTrack(trackTitle: string) {
    if (!pick) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sotd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          release_id: pick.release.id,
          track_title: trackTitle,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("couldntSave"));
      setOpen(false);
      setPick(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("couldntSave"));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pixel-text text-xs uppercase tracking-widest text-accent-primary hover:text-accent-glow transition-colors"
      >
        {hasToday ? t("changePick") : t("setSong")}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {!pick ? (
        <CatalogSearch
          onPick={setPick}
          placeholder={t("placeholder")}
          autoFocus={!hasToday}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-text-muted">
            {t.rich("whichTrack", {
              b: () => (
                <span className="text-text-primary font-bold">{pick.release.title}</span>
              ),
            })}
          </p>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border-subtle divide-y divide-border-subtle">
            {(pick.release.tracks ?? []).map((t) => (
              <button
                key={`${t.position}-${t.title}`}
                type="button"
                disabled={saving}
                onClick={() => chooseTrack(t.title)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-bg-elevated transition-colors disabled:opacity-50"
              >
                <span className="pixel-text text-xs text-text-muted w-6 shrink-0 tabular-nums">
                  {t.position}
                </span>
                <span className="text-text-primary truncate">{t.title}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPick(null)}
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            {t("differentRelease")}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-accent-rose">{error}</p>}

      {hasToday && (
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPick(null);
            setError(null);
          }}
          className="text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          {t("cancel")}
        </button>
      )}
    </div>
  );
}
