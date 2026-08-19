"use client";

/**
 * ReviewForm — Overhaul v2.
 *
 * The old form asked for title, artist, genre, release date, and a
 * pasted cover URL. All of that is gone. The only way to start a
 * review is to pick a REAL release through CatalogSearch (local
 * catalog + Spotify + Genius, unreleased included). Everything
 * descriptive comes from the catalog; the user contributes exactly
 * three things: a rating, their words, and standout track picks.
 *
 * Standout tracks are CHECKBOXES over the release's own track list —
 * no free-text track entry, so nothing can be misspelled or faked.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Release, Review } from "@/lib/types/database";
import CatalogSearch, {
  type CatalogPick,
} from "@/components/catalog/CatalogSearch";
import { getRatingHex } from "@/lib/rating";

interface ReviewFormProps {
  mode: "create" | "edit";
  /** Edit mode: the review being edited. */
  review?: Review;
  /** Edit mode: the attached release (fixed — can't be changed). */
  release?: Release | null;
  /** Edit mode: primary artist display name for the locked card. */
  artistName?: string;
}

export default function ReviewForm({
  mode,
  review,
  release: fixedRelease,
  artistName,
}: ReviewFormProps) {
  const router = useRouter();

  // The picked release. In edit mode this is locked to the prop.
  const [release, setRelease] = useState<Release | null>(fixedRelease ?? null);
  const [pickedArtist, setPickedArtist] = useState<string>(
    artistName ?? review?.artist ?? ""
  );

  const [rating, setRating] = useState(review?.rating ?? 7);
  const [summary, setSummary] = useState(review?.summary ?? "");
  const [snippet, setSnippet] = useState(review?.snippet ?? "");
  const [pickedTracks, setPickedTracks] = useState<Set<string>>(
    new Set((review?.standout_tracks ?? []).map((t) => t.title))
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ratingColor = getRatingHex(rating);
  const tracks = release?.tracks ?? [];
  const year = release?.release_date?.slice(0, 4) ?? null;

  function handlePick(pick: CatalogPick) {
    setRelease(pick.release);
    setPickedArtist(pick.artist_name);
    // A fresh release means fresh track picks.
    setPickedTracks(new Set());
  }

  function toggleTrack(title: string) {
    setPickedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  async function handleSubmit(isPublished: boolean) {
    if (!release) {
      setError("Pick a release first — search above.");
      return;
    }

    setSaving(true);
    setError(null);

    // Build standout picks with Spotify links where the catalog has them.
    const standout_tracks = tracks
      .filter((t) => pickedTracks.has(t.title))
      .map((t) => ({
        title: t.title,
        spotifyUrl: t.spotify_id
          ? `https://open.spotify.com/track/${t.spotify_id}`
          : "",
      }));

    const body = {
      release_id: release.id,
      rating,
      summary: summary || null,
      snippet: snippet || null,
      standout_tracks,
      is_published: isPublished,
    };

    try {
      const res =
        mode === "edit" && review
          ? await fetch(`/api/reviews/${review.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
          : await fetch("/api/reviews", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Friendly duplicate handling: jump to the existing review.
        if (res.status === 409 && data.existing_slug) {
          router.push(`/reviews/${data.existing_slug}/edit`);
          return;
        }
        setError(data.error || "Something went wrong.");
        setSaving(false);
        return;
      }

      router.push("/reviews/mine");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">
          {mode === "edit" ? "Edit Review" : "Write a Review"}
        </h1>
        <p className="pixel-text text-lg text-text-secondary">
          {mode === "edit"
            ? "update your take — the release stays locked in"
            : "find the record, drop your honest take"}
        </p>
      </div>

      {/* ========== STEP 1: THE RELEASE ==========
          overflow-visible: this panel hosts the search dropdown —
          the panel's default overflow:hidden would clip the list. */}
      <fieldset className="panel-xbox overflow-visible p-5 space-y-4">
        <legend className="label-xbox">The Release</legend>

        {release ? (
          <div className="flex items-center gap-4 p-3 rounded-lg border border-[rgba(var(--accent-rgb),0.4)] bg-[rgba(var(--accent-rgb),0.08)]">
            {/* Locked-in cover */}
            <div className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 bg-bg-elevated shrink-0">
              {release.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={release.cover_image}
                  alt={`${release.title} cover`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-2xl">
                  💿
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-[family-name:var(--font-heading)] font-bold text-text-primary truncate">
                {release.title}
              </p>
              <p className="text-sm text-text-secondary truncate">
                {pickedArtist}
                {year ? ` · ${year}` : ""} · {release.release_type}
              </p>
              {release.is_unreleased && (
                <span className="pixel-text text-[10px] text-osd-amber border border-osd-amber/40 rounded px-1 py-0.5 inline-block mt-1">
                  UNRELEASED
                </span>
              )}
            </div>

            {/* Release is only swappable while creating. */}
            {mode === "create" && (
              <button
                type="button"
                onClick={() => {
                  setRelease(null);
                  setPickedTracks(new Set());
                }}
                className="label-xbox hover:text-accent-primary transition-colors text-[0.65rem] shrink-0"
              >
                Change
              </button>
            )}
          </div>
        ) : (
          <CatalogSearch
            onPick={handlePick}
            autoFocus
            placeholder="Search any album, song, or artist…"
          />
        )}

        <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
          everything on Peak Music Reviews is tied to a real release — spotify catalog +
          genius deep cuts (unreleased included)
        </p>
      </fieldset>

      {/* ========== STEP 2: THE VERDICT ========== */}
      <fieldset className="panel-xbox p-5 space-y-4">
        <legend className="label-xbox">Your Verdict</legend>

        <div className="flex items-center gap-5">
          {/* Big live rating readout */}
          <div
            className="rating-badge shrink-0"
            style={{
              width: "4.5rem",
              height: "4.5rem",
              fontSize: "1.6rem",
              color: ratingColor,
              borderColor: ratingColor,
              background: `${ratingColor}15`,
            }}
          >
            {rating.toFixed(1)}
          </div>

          <div className="flex-1 space-y-2">
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={rating}
              onChange={(e) => setRating(parseFloat(e.target.value))}
              className="w-full h-2 bg-[rgba(255,255,255,0.05)] rounded-full appearance-none cursor-pointer"
              style={{ accentColor: ratingColor }}
              aria-label="Rating from 0 to 10"
            />
            <div className="flex justify-between text-xs text-text-muted font-[family-name:var(--font-vt323)]">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
        </div>

        <FormField label={`One-liner (${snippet.length}/200) — optional`}>
          <input
            type="text"
            value={snippet}
            onChange={(e) => setSnippet(e.target.value.slice(0, 200))}
            placeholder="The short version of your take…"
            maxLength={200}
            className="form-input"
          />
          <p className="text-xs text-text-muted mt-1">
            Shows as the preview text on cards and feeds
          </p>
        </FormField>

        <FormField label={`Full review (${summary.length}/10000) — optional`}>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value.slice(0, 10000))}
            placeholder="What stands out? What doesn't work? Liking something for a dumb reason is just as valid as a technical breakdown."
            rows={10}
            maxLength={10000}
            className="form-input resize-none"
          />
        </FormField>
      </fieldset>

      {/* ========== STEP 3: STANDOUT TRACKS (checkbox picks) ========== */}
      {release && tracks.length > 0 && (
        <fieldset className="panel-xbox p-5 space-y-3">
          <legend className="label-xbox">Standout Tracks</legend>
          <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
            check the ones that hit — picked straight from the tracklist
          </p>

          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {tracks.map((track) => {
              const picked = pickedTracks.has(track.title);
              return (
                <label
                  key={`${track.position}-${track.title}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
                    picked
                      ? "border-[rgba(var(--accent-rgb),0.4)] bg-[rgba(var(--accent-rgb),0.1)]"
                      : "border-transparent hover:bg-bg-elevated"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={picked}
                    onChange={() => toggleTrack(track.title)}
                    className="accent-[var(--accent-primary)] w-4 h-4"
                  />
                  <span className="pixel-text text-sm text-text-muted w-6 shrink-0 text-right">
                    {track.position}
                  </span>
                  <span
                    className={`text-sm truncate ${
                      picked ? "text-text-primary font-medium" : "text-text-secondary"
                    }`}
                  >
                    {track.title}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* ========== ERROR ========== */}
      {error && (
        <div className="panel-xbox p-4 border-red-500/30 bg-red-500/5">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* ========== ACTIONS ========== */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={saving || !release}
          className="btn-y2k btn-y2k-primary disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : mode === "edit"
            ? "Update & Publish"
            : "Publish Review"}
        </button>

        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={saving || !release}
          className="btn-y2k btn-y2k-outline disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save as Draft"}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="btn-y2k btn-y2k-outline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-[family-name:var(--font-heading)] text-xs font-bold text-text-secondary uppercase tracking-wider block">
        {label}
      </label>
      {children}
    </div>
  );
}
