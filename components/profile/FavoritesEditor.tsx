"use client";

/**
 * FavoritesEditor — the settings-page editor for the "four favorites"
 * showcase (Letterboxd style).
 *
 * Four slots. Each is filled by picking a REAL release through
 * CatalogSearch (local catalog + Spotify + Genius, imported on
 * demand) — there is no free-text entry anymore, so every favorite
 * carries a release_id, proper title/artist, and real cover art.
 *
 * "Save Favorites" PUTs the whole set to /api/profile/favorites,
 * which deletes cleared slots and upserts the rest.
 */

import { useEffect, useState } from "react";
import CatalogSearch, {
  type CatalogPick,
} from "@/components/catalog/CatalogSearch";
import type { ProfileFavorite } from "@/lib/types/database";

/** Editable state for one of the four slots. */
interface SlotState {
  title: string;
  artist: string;
  cover_image: string; // "" = none
  release_id: string | null;
}

const EMPTY_SLOT: SlotState = {
  title: "",
  artist: "",
  cover_image: "",
  release_id: null,
};

/** Only https:// or local /path covers get previewed. */
function safeCover(url: string): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

export default function FavoritesEditor() {
  // One entry per slot (index 0–3 = positions 1–4).
  const [slots, setSlots] = useState<SlotState[]>([
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the current favorites once on mount.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/profile/favorites");
        if (!res.ok) return; // not logged in / error — leave slots empty
        const data = (await res.json()) as { favorites?: ProfileFavorite[] };
        if (cancelled || !data.favorites) return;

        setSlots((prev) => {
          const next = prev.map((s) => ({ ...s }));
          for (const fav of data.favorites!) {
            const idx = fav.position - 1; // position 1–4 -> index 0–3
            if (idx < 0 || idx > 3) continue;
            next[idx] = {
              title: fav.title,
              artist: fav.artist,
              cover_image: fav.cover_image ?? "",
              release_id: fav.release_id,
            };
          }
          return next;
        });
      } catch {
        // network hiccup — the editor just starts blank
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /** A catalog pick fills the whole slot in one go. */
  function handlePick(index: number, pick: CatalogPick) {
    setSlots((prev) =>
      prev.map((slot, i) =>
        i === index
          ? {
              title: pick.release.title,
              artist: pick.artist_name,
              cover_image: pick.release.cover_image ?? "",
              release_id: pick.release.id,
            }
          : slot
      )
    );
    setSaved(false);
  }

  /** Clear a slot back to empty. */
  function removeSlot(index: number) {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...EMPTY_SLOT } : slot))
    );
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    // Filled slots only — a slot is filled exactly when a catalog
    // pick landed in it (title + artist always arrive together).
    const favorites = slots
      .map((slot, i) => ({ slot, position: i + 1 }))
      .filter(({ slot }) => slot.title.trim() && slot.artist.trim())
      .map(({ slot, position }) => ({
        position,
        title: slot.title.trim(),
        artist: slot.artist.trim(),
        ...(slot.cover_image ? { cover_image: slot.cover_image } : {}),
        ...(slot.release_id ? { release_id: slot.release_id } : {}),
      }));

    setSaving(true);
    try {
      const res = await fetch("/api/profile/favorites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error || "Failed to save favorites."
        );
        setSaving(false);
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    }
    setSaving(false);
  }

  if (loading) {
    return <p className="osd-text text-sm animate-pulse">TUNING…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Pick up to four records to showcase at the top of your profile.
        Search covers everything on Spotify plus the deep Genius catalog
        (unreleased included).
      </p>

      {/* The four slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {slots.map((slot, i) => {
          const filled = slot.title.trim().length > 0;
          const cover = safeCover(slot.cover_image);

          return (
            <div key={i} className="card-y2k p-3 space-y-3">
              {/* Slot header + remove button */}
              <div className="flex items-center justify-between">
                <span className="label-xbox text-[0.6rem]">Slot {i + 1}</span>
                {filled && (
                  <button
                    type="button"
                    onClick={() => removeSlot(i)}
                    className="text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors font-[family-name:var(--font-heading)]"
                  >
                    Remove
                  </button>
                )}
              </div>

              {filled ? (
                /* Filled slot: show the pick. To change it, remove first —
                   keeps the UI honest about what's saved in the slot. */
                <div className="flex items-center gap-3">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt=""
                      className="w-14 h-14 rounded object-cover border border-white/10"
                    />
                  ) : (
                    <span className="w-14 h-14 rounded bg-bg-elevated border border-white/10 flex items-center justify-center text-xl">
                      💿
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate font-medium">
                      {slot.title}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {slot.artist}
                    </p>
                  </div>
                </div>
              ) : (
                /* Empty slot: the catalog picker */
                <CatalogSearch
                  onPick={(pick) => handlePick(i, pick)}
                  placeholder="Search any album or song…"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Feedback + save */}
      {error && (
        <div className="panel-xbox p-3 border-red-500/30 bg-red-500/5">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      {saved && (
        <div className="panel-xbox p-3 border-green-500/30 bg-green-500/5">
          <p className="text-green-400 text-sm font-bold">Favorites saved!</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="btn-y2k btn-y2k-primary disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Favorites"}
      </button>
    </div>
  );
}
