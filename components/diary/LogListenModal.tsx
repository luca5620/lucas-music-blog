"use client";

/**
 * LogListenModal — the "Log a listen" flow (Letterboxd-style).
 *
 * Renders its own trigger button plus a modal dialog with:
 *  - SpotifyAutocomplete to pick a catalog release (or free-text
 *    title/artist for music we haven't imported yet)
 *  - a date picker defaulting to today (can't be in the future)
 *  - an optional 0.0–10.0 rating (leave blank = just logging it)
 *  - a 500-char note with a live counter
 *  - a "listened before" (relisten) checkbox
 *
 * On submit it POSTs to /api/diary and calls router.refresh() so the
 * server-rendered timeline + stats pick up the new entry.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import SpotifyAutocomplete, {
  type AutocompleteItem,
} from "@/components/spotify/SpotifyAutocomplete";

/** Today's date in the USER'S timezone, as YYYY-MM-DD (for <input type="date">).
 *  toISOString() alone would give UTC, which is "tomorrow" for some timezones. */
function localToday(): string {
  const now = new Date();
  // Shift by the timezone offset so the ISO slice reflects local time.
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 10);
}

/** Same color ramp used by the review UI — high scores glow purple/green. */
function getRatingColor(r: number): string {
  if (r >= 9) return "#a855f7";
  if (r >= 8) return "#22c55e";
  if (r >= 7) return "#84cc16";
  if (r >= 6) return "#eab308";
  if (r >= 5) return "#f97316";
  if (r >= 4) return "#ef4444";
  return "#dc2626";
}

// Minimal shape of the release we attach from the autocomplete.
interface AttachedRelease {
  id: string;
  title: string;
  artist_name: string;
  cover_image: string | null;
}

export default function LogListenModal() {
  const router = useRouter();

  // Whether the dialog is visible.
  const [open, setOpen] = useState(false);

  // --- form state ---
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [attachedRelease, setAttachedRelease] =
    useState<AttachedRelease | null>(null);
  const [listenedOn, setListenedOn] = useState(localToday());
  // Rating is kept as a STRING so the field can be empty (= unrated).
  const [rating, setRating] = useState("");
  const [note, setNote] = useState("");
  const [isRelisten, setIsRelisten] = useState(false);

  // --- request state ---
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Picking a release from the autocomplete fills in everything. */
  const handleReleaseSelect = useCallback((item: AutocompleteItem) => {
    setReleaseId(item.id);
    setAttachedRelease({
      id: item.id,
      title: item.title,
      artist_name: item.artist_name,
      cover_image: item.cover_image,
    });
    setTitle(item.title);
    setArtist(item.artist_name);
    setCoverImage(item.cover_image ?? "");
  }, []);

  /** "Change" button — detach the release but keep the typed text. */
  const handleReleaseClear = useCallback(() => {
    setReleaseId(null);
    setAttachedRelease(null);
  }, []);

  /** Reset every field back to a fresh form. */
  const resetForm = useCallback(() => {
    setTitle("");
    setArtist("");
    setCoverImage("");
    setReleaseId(null);
    setAttachedRelease(null);
    setListenedOn(localToday());
    setRating("");
    setNote("");
    setIsRelisten(false);
    setError(null);
  }, []);

  async function handleSubmit() {
    // Client-side checks mirror the API's validation for fast feedback.
    if (!title.trim() || !artist.trim()) {
      setError("Title and artist are required.");
      return;
    }

    // Empty rating string = "no rating" (null). Otherwise parse + bound it.
    let ratingValue: number | null = null;
    if (rating.trim() !== "") {
      const parsed = parseFloat(rating);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 10) {
        setError("Rating must be between 0.0 and 10.0.");
        return;
      }
      ratingValue = Math.round(parsed * 10) / 10;
    }

    if (listenedOn > localToday()) {
      setError("You can't log a listen in the future.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          cover_image: coverImage || null,
          listened_on: listenedOn,
          rating: ratingValue,
          note: note.trim() || null,
          is_relisten: isRelisten,
          release_id: releaseId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong.");
        setSaving(false);
        return;
      }

      // Success: close, clear, and re-fetch the server components
      // (timeline + stats) so the new entry appears immediately.
      setSaving(false);
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  // Preview color for whatever rating is currently typed.
  const parsedRating = parseFloat(rating);
  const hasRating = rating.trim() !== "" && !Number.isNaN(parsedRating);
  const ratingColor = hasRating ? getRatingColor(parsedRating) : "#5a5a60";

  return (
    <>
      {/* ===== Trigger button (lives wherever the modal is rendered) ===== */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-y2k btn-y2k-primary shrink-0"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Log a Listen
      </button>

      {/* ===== Modal (only mounted while open) ===== */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Log a listen"
        >
          {/* Dimmed backdrop — clicking it closes the modal. */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Dialog panel */}
          <div className="card-y2k relative w-full max-w-lg p-5 sm:p-6 space-y-4 my-8">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[#e8e6e3]">
                  Log a Listen
                </h2>
                <p className="font-[family-name:var(--font-vt323)] text-[#9a9a9e]">
                  what did you spin today?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[#5a5a60] hover:text-[#e8e6e3] transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* ===== Pick a release (autocomplete or free text) ===== */}
            <div className="space-y-2">
              <span className="label-xbox block">What did you listen to?</span>
              {attachedRelease ? (
                // A release is attached — show it with a "Change" escape hatch.
                <div className="flex items-center gap-3 p-2 rounded-lg border border-[rgba(30,144,255,0.4)] bg-[rgba(30,144,255,0.08)]">
                  <div className="w-12 h-12 rounded bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {attachedRelease.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={attachedRelease.cover_image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-text-muted text-xs">{"//"}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[#e8e6e3] truncate font-medium">
                      {attachedRelease.title}
                    </div>
                    <div className="text-xs text-text-secondary truncate">
                      {attachedRelease.artist_name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleReleaseClear}
                    className="label-xbox hover:text-accent-primary transition-colors text-[0.65rem]"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <SpotifyAutocomplete
                  kind="release"
                  onSelect={handleReleaseSelect}
                  accentColor="#1e90ff"
                  placeholder="Search for an album, single, or EP..."
                  notFoundCta={
                    <span>
                      Not in the catalog — just type the title and artist below.
                    </span>
                  }
                />
              )}
            </div>

            {/* Free-text fallback (also editable after attaching) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="label-xbox block">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                  placeholder="Album / EP / Single"
                  maxLength={200}
                  className="form-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-xbox block">Artist *</label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value.slice(0, 200))}
                  placeholder="Artist name"
                  maxLength={200}
                  className="form-input"
                />
              </div>
            </div>

            {/* ===== Date + optional rating ===== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="label-xbox block">Listened on</label>
                <input
                  type="date"
                  value={listenedOn}
                  max={localToday()} // browser-side guard against future dates
                  onChange={(e) => setListenedOn(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-xbox block">
                  Rating <span className="text-[#5a5a60]">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={10}
                    step={0.1}
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    placeholder="—"
                    className="form-input"
                  />
                  {/* Live color badge preview, same look as review ratings */}
                  <span
                    className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold font-[family-name:var(--font-heading)]"
                    style={{
                      background: `${ratingColor}15`,
                      border: `2px solid ${ratingColor}`,
                      color: ratingColor,
                    }}
                  >
                    {hasRating ? parsedRating.toFixed(1) : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* ===== Note (500 max, live counter) ===== */}
            <div className="space-y-1.5">
              <label className="label-xbox block">
                Note{" "}
                <span className="text-[#5a5a60]">({note.length}/500)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                placeholder="A quick thought — not a full review..."
                rows={3}
                maxLength={500}
                className="form-input resize-none"
              />
            </div>

            {/* ===== Relisten checkbox ===== */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRelisten}
                onChange={(e) => setIsRelisten(e.target.checked)}
                className="w-4 h-4 accent-[#1e90ff]"
              />
              <span className="font-[family-name:var(--font-vt323)] text-[#9a9a9e]">
                <span aria-hidden>↻</span> I&apos;ve listened to this before
              </span>
            </label>

            {/* ===== Error ===== */}
            {error && (
              <div className="panel-xbox p-3 border-red-500/30 bg-red-500/5">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* ===== Actions ===== */}
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="btn-y2k btn-y2k-primary disabled:opacity-50"
              >
                {saving ? "Logging..." : "Log It"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-y2k btn-y2k-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
