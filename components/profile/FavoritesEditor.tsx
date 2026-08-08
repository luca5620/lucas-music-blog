"use client";

/**
 * FavoritesEditor — the settings-page editor for the "four favorites"
 * showcase (Letterboxd style).
 *
 * Four slots. Each one can be filled either by:
 *  - picking a catalog release via SpotifyAutocomplete (fills title,
 *    artist, cover, and release_id in one click), or
 *  - typing a free-text title + artist for music we haven't imported.
 *
 * "Save Favorites" PUTs the whole set to /api/profile/favorites,
 * which deletes cleared slots and upserts the rest.
 */

import { useEffect, useState } from "react";
import SpotifyAutocomplete, {
  type AutocompleteItem,
} from "@/components/spotify/SpotifyAutocomplete";
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

  // Bumping a slot's key remounts its autocomplete so the search box
  // clears when the slot is removed or replaced.
  const [slotKeys, setSlotKeys] = useState<number[]>([0, 0, 0, 0]);

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

  /** Update one field of one slot. */
  function updateSlot(index: number, patch: Partial<SlotState>) {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot))
    );
    setSaved(false);
  }

  /** A catalog pick fills the whole slot in one go. */
  function handleSelect(index: number, item: AutocompleteItem) {
    updateSlot(index, {
      title: item.title,
      artist: item.artist_name,
      cover_image: item.cover_image ?? "",
      release_id: item.id,
    });
  }

  /** Clear a slot back to empty (and reset its autocomplete input). */
  function removeSlot(index: number) {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...EMPTY_SLOT } : slot))
    );
    setSlotKeys((prev) => prev.map((k, i) => (i === index ? k + 1 : k)));
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    // Build the payload from filled slots. A slot counts as filled
    // when it has BOTH a title and an artist; half-filled slots are
    // a user mistake we flag instead of silently dropping.
    const favorites: {
      position: number;
      title: string;
      artist: string;
      cover_image?: string;
      release_id?: string;
    }[] = [];

    for (let i = 0; i < 4; i++) {
      const slot = slots[i];
      const hasTitle = slot.title.trim().length > 0;
      const hasArtist = slot.artist.trim().length > 0;
      if (!hasTitle && !hasArtist) continue; // genuinely empty slot
      if (!hasTitle || !hasArtist) {
        setError(`Slot ${i + 1} needs both a title and an artist.`);
        return;
      }
      favorites.push({
        position: i + 1,
        title: slot.title.trim(),
        artist: slot.artist.trim(),
        ...(slot.cover_image ? { cover_image: slot.cover_image } : {}),
        ...(slot.release_id ? { release_id: slot.release_id } : {}),
      });
    }

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
    return (
      <p className="font-[family-name:var(--font-vt323)] text-[#5a5a60] animate-pulse">
        Loading favorites...
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#5a5a60]">
        Pick up to four albums to showcase at the top of your profile —
        search the catalog or just type a title and artist.
      </p>

      {/* The four slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {slots.map((slot, i) => {
          const filled =
            slot.title.trim().length > 0 || slot.artist.trim().length > 0;
          const cover = safeCover(slot.cover_image);

          return (
            <div
              key={i}
              className="card-y2k p-3 space-y-3"
            >
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

              {/* Cover preview (when a catalog pick / cover is set) */}
              {cover && (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cover}
                    alt=""
                    className="w-12 h-12 rounded object-cover border border-white/10"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-[#e8e6e3] truncate font-medium">
                      {slot.title}
                    </p>
                    <p className="text-xs text-[#9a9a9e] truncate">
                      {slot.artist}
                    </p>
                  </div>
                </div>
              )}

              {/* Catalog search — remounts (clears) when the slot resets */}
              <SpotifyAutocomplete
                key={`fav-slot-${i}-${slotKeys[i]}`}
                kind="release"
                onSelect={(item) => handleSelect(i, item)}
                placeholder="Search the catalog..."
                notFoundCta={
                  <span>Not in the catalog — type it below instead.</span>
                }
              />

              {/* Free-text fallback (also lets you tweak a pick) */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={slot.title}
                  onChange={(e) =>
                    updateSlot(i, {
                      title: e.target.value.slice(0, 200),
                      // Manual edits detach the catalog link — the
                      // text no longer matches the release.
                      release_id: null,
                    })
                  }
                  placeholder="Title"
                  maxLength={200}
                  className="form-input"
                />
                <input
                  type="text"
                  value={slot.artist}
                  onChange={(e) =>
                    updateSlot(i, {
                      artist: e.target.value.slice(0, 200),
                      release_id: null,
                    })
                  }
                  placeholder="Artist"
                  maxLength={200}
                  className="form-input"
                />
              </div>
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
