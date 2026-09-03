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

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Release, Review } from "@/lib/types/database";
import CatalogSearch, {
  type CatalogPick,
} from "@/components/catalog/CatalogSearch";
import { getRatingHex, getRatingColor, formatRating } from "@/lib/rating";
import { hapticTap } from "@/lib/native";
import { useTranslations } from "next-intl";

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
  // LANGUAGES: messages → reviews.form (+ common for cover alt / cancel).
  const t = useTranslations("reviews.form");
  const tc = useTranslations("common");

  /* ── Autosave (create mode) — a swipe-back or closed tab should
     never eat someone's essay (Luca 2026-08-27). Everything the form
     holds mirrors into localStorage, debounced; a fresh visit offers
     the draft back. Cleared on successful submit. All storage access
     is try/catch'd — private mode etc. just means no net. ── */
  const DRAFT_KEY = "pmr:review-draft";
  const [restoredDraft, setRestoredDraft] = useState(false);
  const skipNextSave = useRef(true); // don't re-save the restore itself

  useEffect(() => {
    if (mode !== "create" || fixedRelease) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        release?: Release | null;
        pickedArtist?: string;
        rating?: number;
        summary?: string;
        snippet?: string;
        pickedTracks?: string[];
      };
      // Only offer drafts that actually contain words or a pick.
      if (!d.release && !d.summary && !d.snippet) return;
      if (d.release) setRelease(d.release);
      if (d.pickedArtist) setPickedArtist(d.pickedArtist);
      if (typeof d.rating === "number") setRating(d.rating);
      setSummary(d.summary ?? "");
      setSnippet(d.snippet ?? "");
      setPickedTracks(new Set(d.pickedTracks ?? []));
      setRestoredDraft(true);
    } catch {
      /* unreadable draft — start clean */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== "create") return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const t = setTimeout(() => {
      try {
        // Nothing worth keeping → keep storage clean.
        if (!release && !summary && !snippet) {
          localStorage.removeItem(DRAFT_KEY);
          return;
        }
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            release,
            pickedArtist,
            rating,
            summary,
            snippet,
            pickedTracks: [...pickedTracks],
            savedAt: Date.now(),
          })
        );
      } catch {
        /* storage full/blocked — autosave is garnish */
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [release, pickedArtist, rating, summary, snippet, pickedTracks, mode]);

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* fine */
    }
  }

  function discardDraft() {
    clearDraft();
    setRelease(null);
    setPickedArtist("");
    setRating(7);
    setSummary("");
    setSnippet("");
    setPickedTracks(new Set());
    setRestoredDraft(false);
  }

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
      setError(t("pickFirst"));
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
        setError(data.error || t("wentWrong"));
        setSaving(false);
        return;
      }

      clearDraft(); // the words made it to the DB — retire the backup
      router.push("/reviews/mine");
      router.refresh();
    } catch {
      setError(t("networkError"));
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header — same centered module + plain-sentence intro as the
          posts/debates create pages (Luca 2026-08-26: one consistent
          format across everything the create button offers). */}
      <div className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">
          {mode === "edit" ? t("editTitle") : t("writeTitle")}
        </h1>
        <p className="text-sm text-text-secondary">
          {mode === "edit" ? t("editSub") : t("writeSub")}
        </p>
      </div>

      {/* Autosave pickup — quiet, dismissible, only after a restore */}
      {restoredDraft && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-accent-primary/30 bg-accent-primary/5">
          <p className="text-xs text-text-secondary">
            {t.rich("draftRestored", {
              b: (chunks) => <span className="text-accent-primary font-bold">{chunks}</span>,
            })}
          </p>
          <button
            type="button"
            onClick={discardDraft}
            className="text-[11px] uppercase tracking-wider text-text-muted hover:text-accent-rose shrink-0 transition-colors"
          >
            {t("discard")}
          </button>
        </div>
      )}

      {/* ========== STEP 1: THE RELEASE ==========
          overflow-visible: this panel hosts the search dropdown —
          the panel's default overflow:hidden would clip the list. */}
      <fieldset className="panel-xbox overflow-visible p-5 space-y-4">
        <legend className="label-xbox">{t("theRelease")}</legend>

        {release ? (
          <div className="flex items-center gap-4 p-3 rounded-lg border border-[rgba(var(--accent-rgb),0.4)] bg-[rgba(var(--accent-rgb),0.08)]">
            {/* Locked-in cover */}
            <div className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 bg-bg-elevated shrink-0">
              {release.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={release.cover_image}
                  alt={tc("coverAlt", { title: release.title })}
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
                  {t("unreleasedStamp")}
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
                {t("change")}
              </button>
            )}
          </div>
        ) : (
          <CatalogSearch
            onPick={handlePick}
            autoFocus
            placeholder={t("searchPlaceholder")}
          />
        )}

        <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
          {t("tiedNote")}
        </p>

        {/* The door for releases the search can't reach (Luca
            2026-09-02): Bandcamp-only records, private-press stuff,
            regional catalogs, anything neither Spotify nor Genius
            carries. Staff import those by hand through the admin
            tool's Manual tab, so the ask is one email. Shown only
            while picking, and only in create mode — once a release is
            locked in there's nothing left to be missing. */}
        {mode === "create" && !release && (
          <p className="text-xs text-text-secondary leading-relaxed border-t border-border-subtle pt-3">
            {t.rich("cantFind", {
              b: (chunks) => <span className="text-text-primary font-bold">{chunks}</span>,
              a: (chunks) => (
                <a
                  href="mailto:contact@peakmusicreviews.com?subject=Please%20import%20a%20release"
                  className="text-accent-primary hover:underline"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        )}
      </fieldset>

      {/* ========== STEP 2: THE VERDICT ========== */}
      <fieldset className="panel-xbox p-5 space-y-4">
        <legend className="label-xbox">{t("verdict")}</legend>

        <div className="flex items-center gap-5">
          {/* Big live rating readout — the SAME badge treatment the
              home-page cards use (getRatingColor supplies the tier
              classes, so 9.5+ pulses the purple elite glow and a 10
              goes full rating-perfect), just scaled up a bit. */}
          <div
            className={`rating-badge shrink-0 w-14 h-14 text-2xl ${getRatingColor(rating)}`}
            style={{ color: ratingColor, borderColor: ratingColor }}
          >
            {formatRating(rating)}
          </div>

          <div className="flex-1 space-y-2">
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={rating}
              onChange={(e) => {
                // onChange only fires when the value actually moves, so
                // this ratchets once per 0.1 tick — the iOS-picker feel.
                // No-op on web.
                hapticTap();
                setRating(parseFloat(e.target.value));
              }}
              // .rating-slider (globals.css) rebuilds the thumb that
              // appearance:none removes — accentColor alone did
              // nothing once the native look was stripped, so the
              // ball was invisible. The inline gradient fills the
              // track up to the current score in the rating color.
              className={`rating-slider${
                rating === 10
                  ? " rating-slider-perfect"
                  : rating >= 9.5
                    ? " rating-slider-elite"
                    : ""
              }`}
              style={
                {
                  "--slider-color": ratingColor,
                  background: `linear-gradient(90deg, ${ratingColor}30 0%, ${ratingColor}99 ${rating * 10}%, rgba(255,255,255,0.08) ${rating * 10}%)`,
                } as React.CSSProperties
              }
              aria-label={t("ratingAria")}
            />
            <div className="flex justify-between text-xs text-text-muted font-[family-name:var(--font-vt323)]">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
        </div>

        <FormField label={t("oneLiner", { n: snippet.length })}>
          <input
            type="text"
            value={snippet}
            onChange={(e) => setSnippet(e.target.value.slice(0, 200))}
            placeholder={t("oneLinerPlaceholder")}
            maxLength={200}
            className="form-input"
          />
          <p className="text-xs text-text-muted mt-1">
            {t("oneLinerHint")}
          </p>
        </FormField>

        <FormField label={t("fullReview", { n: summary.length })}>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value.slice(0, 10000))}
            placeholder={t("fullPlaceholder")}
            rows={10}
            maxLength={10000}
            className="form-input resize-none"
          />
        </FormField>
      </fieldset>

      {/* ========== STEP 3: PERSONAL FAVORITES (checkbox picks) ==========
          (Renamed from "Standout Tracks" 2026-08-25 — display label
          only; the DB column and API field stay standout_tracks.) */}
      {release && tracks.length > 0 && (
        <fieldset className="panel-xbox p-5 space-y-3">
          <legend className="label-xbox">{t("favorites")}</legend>
          <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
            {t("favoritesHint")}
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
            ? tc("saving")
            : mode === "edit"
            ? t("updatePublish")
            : t("publish")}
        </button>

        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={saving || !release}
          className="btn-y2k btn-y2k-outline disabled:opacity-50"
        >
          {saving ? tc("saving") : t("saveDraft")}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="btn-y2k btn-y2k-outline"
        >
          {tc("cancel")}
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
