"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Review } from "@/lib/types/database";
import SpotifyAutocomplete, {
  type AutocompleteItem,
} from "@/components/spotify/SpotifyAutocomplete";

const GENRE_OPTIONS = [
  "Hip-Hop",
  "Pop",
  "Alternative",
  "R&B",
  "Electronic",
  "Rock",
  "Country",
  "Latin",
  "Jazz",
  "Classical",
  "Other",
];

const RELEASE_TYPE_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "EP", label: "EP" },
  { value: "album", label: "Album" },
  { value: "mixtape", label: "Mixtape" },
];

function slugify(title: string, artist: string): string {
  return `${title}-${artist}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface InitialRelease {
  id: string;
  title: string;
  artist_name: string;
  cover_image: string | null;
}

interface ReviewFormProps {
  review?: Review;
  mode: "create" | "edit";
  initialRelease?: InitialRelease;
}

export default function ReviewForm({
  review,
  mode,
  initialRelease,
}: ReviewFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(review?.title ?? "");
  const [artist, setArtist] = useState(review?.artist ?? "");
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [genre, setGenre] = useState(review?.genre ?? "");
  const [releaseType, setReleaseType] = useState(review?.release_type ?? "");
  const [releaseDate, setReleaseDate] = useState(review?.release_date ?? "");
  const [coverImage, setCoverImage] = useState(review?.cover_image ?? "");
  const [snippet, setSnippet] = useState(review?.snippet ?? "");
  const [summary, setSummary] = useState(review?.summary ?? "");
  const [standoutTracks, setStandoutTracks] = useState<
    { title: string; spotifyUrl: string }[]
  >(review?.standout_tracks ?? [{ title: "", spotifyUrl: "" }]);

  const [releaseId, setReleaseId] = useState<string | null>(
    review?.release_id ?? initialRelease?.id ?? null
  );
  const [attachedRelease, setAttachedRelease] = useState<InitialRelease | null>(
    initialRelease ?? null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (item.release_type) setReleaseType(item.release_type);
    if (item.release_date) setReleaseDate(item.release_date);
  }, []);

  const handleReleaseClear = useCallback(() => {
    setReleaseId(null);
    setAttachedRelease(null);
  }, []);

  const slug = slugify(title, artist);

  const addTrack = useCallback(() => {
    setStandoutTracks((prev) => [...prev, { title: "", spotifyUrl: "" }]);
  }, []);

  const removeTrack = useCallback((index: number) => {
    setStandoutTracks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateTrack = useCallback(
    (index: number, field: "title" | "spotifyUrl", value: string) => {
      setStandoutTracks((prev) =>
        prev.map((track, i) =>
          i === index ? { ...track, [field]: value } : track
        )
      );
    },
    []
  );

  async function handleSubmit(isPublished: boolean) {
    if (!title.trim() || !artist.trim()) {
      setError("Title and artist are required.");
      return;
    }

    if (rating < 0 || rating > 10) {
      setError("Rating must be between 0 and 10.");
      return;
    }

    setSaving(true);
    setError(null);

    // Filter out empty standout tracks
    const filteredTracks = standoutTracks.filter((t) => t.title.trim());

    const body = {
      title: title.trim(),
      artist: artist.trim(),
      slug,
      rating,
      genre: genre || null,
      release_type: releaseType || null,
      release_date: releaseDate || null,
      cover_image: coverImage || null,
      snippet: snippet || null,
      summary: summary || null,
      standout_tracks: filteredTracks,
      is_published: isPublished,
      review_date: new Date().toISOString().split("T")[0],
      release_id: releaseId || null,
    };

    try {
      let res: Response;

      if (mode === "edit" && review) {
        res = await fetch(`/api/reviews/${review.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
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

  // Rating color helper (inline to avoid needing server import)
  function getRatingColor(r: number): string {
    if (r >= 9) return "#a855f7";
    if (r >= 8) return "#22c55e";
    if (r >= 7) return "#84cc16";
    if (r >= 6) return "#eab308";
    if (r >= 5) return "#f97316";
    if (r >= 4) return "#ef4444";
    return "#dc2626";
  }

  const ratingColor = getRatingColor(rating);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold text-[#e8e6e3]">
          {mode === "edit" ? "Edit Review" : "Write a Review"}
        </h1>
        <p className="font-[family-name:var(--font-vt323)] text-lg text-[#9a9a9e]">
          {mode === "edit"
            ? "update your thoughts on this release"
            : "share your honest opinion on a release"}
        </p>
        {slug && (
          <p className="font-[family-name:var(--font-vt323)] text-sm text-[#5a5a60]">
            slug: {slug}
          </p>
        )}
      </div>

      {/* Cover Image Preview */}
      {coverImage && (
        <div className="panel-xbox p-4 flex items-center gap-4">
          <img
            src={coverImage}
            alt="Cover preview"
            className="w-20 h-20 rounded-lg object-cover border border-white/10"
          />
          <div>
            <p className="font-[family-name:var(--font-heading)] font-bold text-[#e8e6e3]">
              {title || "Untitled"}
            </p>
            <p className="font-[family-name:var(--font-vt323)] text-[#9a9a9e]">
              {artist || "Unknown Artist"}
            </p>
            <div
              className="mt-1 inline-flex items-center justify-center w-8 h-8 rounded text-sm font-bold font-[family-name:var(--font-heading)]"
              style={{
                background: `${ratingColor}20`,
                border: `2px solid ${ratingColor}`,
                color: ratingColor,
              }}
            >
              {rating}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* ========== BASIC INFO ========== */}
        <fieldset className="panel-xbox p-5 space-y-4">
          <legend className="label-xbox">Release Info</legend>

          {/* ========== PICK A RELEASE ========== */}
          <div className="space-y-2">
            <span className="label-xbox block">Pick a release</span>
            {attachedRelease ? (
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
                    Not in the catalog yet — fill in the title/artist below and
                    we&apos;ll attach it later.
                  </span>
                }
              />
            )}
            <p className="text-xs text-[#5a5a60] font-[family-name:var(--font-vt323)]">
              attaching a release links this review to the canonical release page
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Title *">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Album / EP / Single title"
                required
                className="form-input"
              />
            </FormField>

            <FormField label="Artist *">
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist name"
                required
                className="form-input"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label={`Rating: ${rating}`}>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={rating}
                  onChange={(e) => setRating(parseFloat(e.target.value))}
                  className="w-full accent-[var(--accent-primary)] h-2 bg-[rgba(255,255,255,0.05)] rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: ratingColor }}
                />
                <div className="flex justify-between text-xs text-[#5a5a60] font-[family-name:var(--font-vt323)]">
                  <span>0</span>
                  <span
                    className="font-bold text-sm"
                    style={{ color: ratingColor }}
                  >
                    {rating.toFixed(1)}
                  </span>
                  <span>10</span>
                </div>
              </div>
            </FormField>

            <FormField label="Genre">
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="form-input"
              >
                <option value="">Select genre...</option>
                {GENRE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Release Type">
              <select
                value={releaseType}
                onChange={(e) => setReleaseType(e.target.value)}
                className="form-input"
              >
                <option value="">Select type...</option>
                {RELEASE_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Release Date">
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="form-input"
              />
            </FormField>

            <FormField label="Cover Image URL">
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://example.com/cover.jpg"
                className="form-input"
              />
            </FormField>
          </div>
        </fieldset>

        {/* ========== REVIEW CONTENT ========== */}
        <fieldset className="panel-xbox p-5 space-y-4">
          <legend className="label-xbox">Your Review</legend>

          <FormField label={`Snippet (${snippet.length}/200)`}>
            <input
              type="text"
              value={snippet}
              onChange={(e) => setSnippet(e.target.value.slice(0, 200))}
              placeholder="Short one-liner about this release..."
              maxLength={200}
              className="form-input"
            />
            <p className="text-xs text-[#5a5a60] mt-1">
              Shows as the preview text on cards and feeds
            </p>
          </FormField>

          <FormField label={`Full Review (${summary.length}/10000)`}>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value.slice(0, 10000))}
              placeholder="Write your full review here... What stands out? How does it compare? Would you recommend it?"
              rows={10}
              maxLength={10000}
              className="form-input resize-none"
            />
          </FormField>
        </fieldset>

        {/* ========== STANDOUT TRACKS ========== */}
        <fieldset className="panel-xbox p-5 space-y-4">
          <legend className="label-xbox">Standout Tracks</legend>

          <div className="space-y-3">
            {standoutTracks.map((track, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={track.title}
                    onChange={(e) =>
                      updateTrack(index, "title", e.target.value)
                    }
                    placeholder="Track title"
                    className="form-input"
                  />
                  <input
                    type="url"
                    value={track.spotifyUrl}
                    onChange={(e) =>
                      updateTrack(index, "spotifyUrl", e.target.value)
                    }
                    placeholder="Spotify URL (optional)"
                    className="form-input"
                  />
                </div>
                {standoutTracks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTrack(index)}
                    className="mt-2 text-[#5a5a60] hover:text-accent-rose transition-colors"
                    title="Remove track"
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
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addTrack}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-primary hover:text-accent-glow transition-colors font-[family-name:var(--font-heading)] uppercase tracking-wider"
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
            Add Track
          </button>
        </fieldset>

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
            disabled={saving}
            className="btn-y2k btn-y2k-primary disabled:opacity-50"
          >
            {saving ? "Saving..." : mode === "edit" ? "Update & Publish" : "Publish Review"}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="btn-y2k btn-y2k-outline disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save as Draft"}
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            className="btn-y2k btn-y2k-outline disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   Form Field wrapper component
   ============================================ */

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-[family-name:var(--font-heading)] text-xs font-bold text-[#9a9a9e] uppercase tracking-wider block">
        {label}
      </label>
      {children}
    </div>
  );
}
