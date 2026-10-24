"use client";

/**
 * PlayerPick — "Where do you listen?" on the /start screen (2026-10-24).
 *
 * WHY: the preview-player choice (Spotify or Apple Music on release
 * pages, migration 036) only lived deep in Settings, and on 2026-10-24
 * all 105 members were still on the Spotify default — the Apple option
 * had zero takers, most likely because nobody knew it was there (Luca).
 * Every new account passes /start once, so the choice is put in front
 * of them here, one tap, with Spotify already selected so ignoring it
 * changes nothing.
 *
 * Same column, same two values as Settings → Preview Player, written
 * straight from the browser with the member's own session (the
 * "update your own profile" policy allows it — the Settings page saves
 * it the same way). Saves on tap; no separate Save button.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import PlatformIcon from "@/components/profile/PlatformIcons";
import { hapticTap } from "@/lib/native";

type Player = "spotify" | "apple";

const OPTIONS: { id: Player; label: string; icon: "spotify" | "apple_music" }[] = [
  { id: "spotify", label: "Spotify", icon: "spotify" },
  { id: "apple", label: "Apple Music", icon: "apple_music" },
];

export default function PlayerPick({
  userId,
  initial,
}: {
  userId: string;
  /** What's saved now. A leftover 'soundcloud' pick arrives as Spotify. */
  initial: Player;
}) {
  const t = useTranslations("start");
  const [player, setPlayer] = useState<Player>(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");

  async function choose(next: Player) {
    if (saving || next === player) return;
    hapticTap();
    const previous = player;
    // Light the new card at once; put it back if the save fails.
    setPlayer(next);
    setSaving(true);
    setStatus("idle");
    const { error } = await createClient()
      .from("profiles")
      .update({ preferred_player: next } as never)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setPlayer(previous);
      setStatus("failed");
    } else {
      setStatus("saved");
    }
  }

  return (
    <section className="panel-xbox p-4 sm:p-5 space-y-3" aria-labelledby="player-pick-label">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p id="player-pick-label" className="osd-text text-xs">
          {t("playerLabel")}
        </p>
        {/* aria-live so a screen reader hears the save land. */}
        <p className="text-[11px] text-text-muted" aria-live="polite">
          {status === "saved" ? t("playerSaved") : status === "failed" ? t("playerFailed") : ""}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="player-pick-label">
        {OPTIONS.map((o) => {
          const active = player === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(o.id)}
              disabled={saving}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold transition-colors disabled:cursor-wait ${
                active
                  ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                  : "border-border-medium bg-black/25 text-text-secondary hover:text-text-primary"
              }`}
            >
              <PlatformIcon platform={o.icon} className="w-4 h-4 shrink-0" />
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-text-muted">{t("playerHint")}</p>
    </section>
  );
}
