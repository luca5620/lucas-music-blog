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
import Link from "next/link";
import type { Release, Review } from "@/lib/types/database";
import CatalogSearch, {
  type CatalogPick,
  type CatalogResult,
} from "@/components/catalog/CatalogSearch";
import PreviewButton from "@/components/catalog/PreviewButton";
import { stopPreview } from "@/lib/preview-player";
import { getRatingHex, getRatingColor, formatRating } from "@/lib/rating";
import { useTranslations } from "next-intl";
import { localDateString } from "@/lib/review-date";
import GifAttach from "@/components/ui/GifAttach";
import { gifFromRow, KLIPY_APP_KEY, type Gif } from "@/lib/gif";
import ScoreSlider, { ScoreNumber } from "@/components/reviews/ScoreSlider";
import TrackScoreList from "@/components/reviews/TrackScoreList";
import { useAuth } from "@/components/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";

/** "album" = one score for the record; "songs" = score each song and
    the album score follows their average (Luca 2026-10-24). */
type ScoreMode = "album" | "songs";

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
  // Optional GIF reaction (2026-10-11) — on its own instead of words,
  // or under them. See lib/gif.ts.
  const [gif, setGif] = useState<Gif | null>(
    review ? gifFromRow(review) : null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Song by song (Luca 2026-10-24: "an option to do it track by
     track or not"). One switch inside the one rating screen — not a
     second flow. Song scores save the moment a finger lifts, straight
     into track_ratings (migration 041, the same table the release
     page's TRACK RATINGS tab reads), so nothing new in the database
     and nothing lost if they leave halfway. The ALBUM score is still
     reviews.rating: by default the average of the rated songs, or
     their own number once they tap "Set my own". ── */
  const { user } = useAuth();
  const [scoreMode, setScoreMode] = useState<ScoreMode>("album");
  const [ownScore, setOwnScore] = useState(false);
  const [trackScores, setTrackScores] = useState<Record<number, number>>({});
  const trackTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  /* ── The backfill loop (2026-09-09). Publishing a review in create
     mode does NOT leave the page: the record lands in this strip, the
     form resets to the search box, and the next one is a search away.
     A new member with thirty records in their head rates them in one
     sitting without ever seeing a second flow — this IS the review
     form, the only way in (Quick Rate was rejected for being a second
     way). Drafts still go to My Stuff; an essay is a different mood. ── */
  const [streak, setStreak] = useState<
    {
      slug: string;
      title: string;
      artist: string;
      releaseId: string;
      cover: string | null;
      rating: number;
    }[]
  >([]);
  const last = streak.length > 0 ? streak[streak.length - 1] : null;

  /* ── "Posted" moment (Luca 2026-10-22: "it should be more clear that
     you did a review and you want to continue to write more since it
     isn't very clear after completing a review"). The old loop reset
     the form silently with a small strip on top — easy to miss, and it
     looked like the review had vanished. Now publishing swaps the whole
     form for a POSTED card with the next moves spelled out: review
     another, a row of more records by the same artist (tap one and its
     review starts right away), see the review, or done. The form comes
     back only when they choose to keep going. Still the same one form —
     no second flow (Quick Rate stays rejected). ── */
  const [posted, setPosted] = useState(false);
  const [moreFrom, setMoreFrom] = useState<{
    artist: string;
    results: CatalogResult[];
  } | null>(null);
  const [startingNext, setStartingNext] = useState<string | null>(null);
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
        gif?: Gif | null;
        scoreMode?: ScoreMode;
        ownScore?: boolean;
      };
      // Only offer drafts that actually contain words or a pick.
      if (!d.release && !d.summary && !d.snippet && !d.gif) return;
      if (d.release) setRelease(d.release);
      if (d.pickedArtist) setPickedArtist(d.pickedArtist);
      if (typeof d.rating === "number") setRating(d.rating);
      setSummary(d.summary ?? "");
      setSnippet(d.snippet ?? "");
      setPickedTracks(new Set(d.pickedTracks ?? []));
      setGif(d.gif ?? null);
      if (d.scoreMode === "songs") setScoreMode("songs");
      if (d.ownScore) setOwnScore(true);
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
        if (!release && !summary && !snippet && !gif) {
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
            gif,
            scoreMode,
            ownScore,
            savedAt: Date.now(),
          })
        );
      } catch {
        /* storage full/blocked — autosave is garnish */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [release, pickedArtist, rating, summary, snippet, pickedTracks, gif, scoreMode, ownScore, mode]);

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
    setGif(null);
    setScoreMode("album");
    setOwnScore(false);
    setRestoredDraft(false);
  }

  const tracks = release?.tracks ?? [];
  const year = release?.release_date?.slice(0, 4) ?? null;
  // Song by song only means something with 2+ songs.
  const canScoreSongs = tracks.length >= 2;
  const songsMode = canScoreSongs && scoreMode === "songs";

  /* The member's existing song scores for this record (from earlier
     reviews of it or the release page) — loaded whenever the release
     changes, so the list opens already filled in. A record they've
     already scored song by song opens in that mode. */
  const releaseId = release?.id ?? null;
  useEffect(() => {
    setTrackScores({});
    if (!releaseId || !user) return;
    let cancelled = false;
    createClient()
      .from("track_ratings")
      .select("track_position, rating")
      .eq("user_id", user.id)
      .eq("release_id", releaseId)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const rows = data as { track_position: number; rating: number }[];
        const next: Record<number, number> = {};
        for (const r of rows) next[r.track_position] = Number(r.rating);
        setTrackScores(next);
        if (rows.length >= 2) {
          setScoreMode("songs");
          // Editing a review whose score isn't the songs' average → they
          // had set their own; keep it.
          if (review) {
            const avg = rows.reduce((s, r) => s + Number(r.rating), 0) / rows.length;
            if (Math.abs(Math.round(avg * 10) / 10 - review.rating) >= 0.05) setOwnScore(true);
          }
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseId, user?.id]);

  const ratedSongs = Object.values(trackScores);
  const songAverage =
    ratedSongs.length > 0
      ? Math.round((ratedSongs.reduce((s, v) => s + v, 0) / ratedSongs.length) * 10) / 10
      : null;

  // Album score follows the songs' average until they set their own.
  useEffect(() => {
    if (songsMode && !ownScore && songAverage !== null) setRating(songAverage);
  }, [songsMode, ownScore, songAverage]);

  /** One song scored (or cleared): update now, save after a beat so a
      quick re-slide doesn't send two requests. */
  function scoreTrack(position: number, value: number | null) {
    if (!release) return;
    setTrackScores((prev) => {
      const next = { ...prev };
      if (value === null) delete next[position];
      else next[position] = value;
      return next;
    });
    const rid = release.id;
    clearTimeout(trackTimers.current[position]);
    trackTimers.current[position] = setTimeout(() => {
      fetch(`/api/releases/${rid}/track-ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position, rating: value }),
      })
        .then((res) => {
          if (!res.ok) setError(t("songSaveFailed"));
        })
        .catch(() => setError(t("songSaveFailed")));
    }, 350);
  }

  function handlePick(pick: CatalogPick) {
    setRelease(pick.release);
    setPickedArtist(pick.artist_name);
    // A fresh release means fresh track picks and a fresh score mode.
    setPickedTracks(new Set());
    setScoreMode("album");
    setOwnScore(false);
  }

  /** POSTED card → "Review another": back to a clean form + search. */
  function keepGoing() {
    stopPreview();
    setPosted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** POSTED card → a "more from" record: import it, start its review. */
  async function startNext(r: CatalogResult) {
    setStartingNext(`${r.source}:${r.id}`);
    try {
      const res = await fetch("/api/catalog/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: r.source, id: r.id }),
      });
      const data = (await res.json()) as { release?: Release };
      if (!res.ok || !data.release) throw new Error("import failed");
      handlePick({ release: data.release, artist_name: r.artist });
      keepGoing();
    } catch {
      // Fall back to the plain search — never strand them on the card.
      keepGoing();
    } finally {
      setStartingNext(null);
    }
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
    // Song by song with nothing scored yet and no own number → there is
    // no album score to post.
    if (songsMode && !ownScore && songAverage === null) {
      setError(t("needSongs"));
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
      // null = no GIF (or, when editing, "remove the one it had").
      gif,
      is_published: isPublished,
      // This device's own calendar day — the review lands on THE LOG
      // on the day the member actually wrote it, not on the UTC date
      // (which is tomorrow for a US evening). The server sanity-checks
      // it; the edit route ignores it (a review keeps its first date).
      local_date: localDateString(),
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

      if (mode === "create" && isPublished) {
        const created = (await res.json().catch(() => null)) as
          | { slug?: string }
          | null;
        setStreak((prev) => [
          ...prev,
          {
            slug: created?.slug ?? "",
            title: release.title,
            artist: pickedArtist,
            releaseId: release.id,
            cover: release.cover_image ?? null,
            rating,
          },
        ]);
        // Show the POSTED card, and fetch "more from this artist" for
        // it in the background (garnish — no row if it fails/empty).
        stopPreview();
        setPosted(true);
        setMoreFrom(null);
        const postedId = release.id;
        const postedArtist = pickedArtist;
        fetch(`/api/search/catalog?moreFrom=${postedId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { results?: CatalogResult[] } | null) => {
            const reviewed = new Set(streak.map((s) => s.releaseId).concat(postedId));
            const results = (d?.results ?? [])
              .filter((r) => !(r.source === "local" && reviewed.has(r.id)))
              .slice(0, 12);
            if (results.length > 0) setMoreFrom({ artist: postedArtist, results });
          })
          .catch(() => {});
        // Reset to a clean form — the search box comes back focused.
        setRelease(null);
        setPickedArtist("");
        setRating(7);
        setSummary("");
        setSnippet("");
        setPickedTracks(new Set());
        setGif(null);
        setScoreMode("album");
        setOwnScore(false);
        setRestoredDraft(false);
        setSaving(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.refresh();
        return;
      }

      router.push("/reviews/mine");
      router.refresh();
    } catch {
      setError(t("networkError"));
      setSaving(false);
    }
  }

  return (
    <div className={`max-w-2xl mx-auto space-y-6${release && !posted ? " lg:max-w-5xl" : ""}`}>
      {/* Header — same centered module + plain-sentence intro as the
          posts/debates create pages (Luca 2026-08-26: one consistent
          format across everything the create button offers). */}
      <div className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">
          {mode === "edit" ? t("editTitle") : t("writeTitle")}
        </h1>
        <p className="text-sm text-text-secondary">
          {mode === "edit" ? t("editSub") : last ? t("nextSub") : t("writeSub")}
        </p>
      </div>

      {/* ========== POSTED — replaces the form after publishing ========== */}
      {posted && last && (
        <div className="posted-card rounded-xl p-5 space-y-5" role="status" aria-live="polite">
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-white/10 bg-bg-elevated shrink-0">
              {last.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={last.cover}
                  alt={tc("coverAlt", { title: last.title })}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-3xl">💿</span>
              )}
              <span className="posted-stamp">{t("postedStamp")}</span>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="label-xbox text-accent-primary">{t("postedTitle")} ✓</p>
              <p className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary leading-tight line-clamp-2">
                {last.title}
              </p>
              {last.artist && (
                <p className="text-sm text-text-secondary truncate">{last.artist}</p>
              )}
              <p className="text-xs text-text-muted">{t("postedLive")}</p>
            </div>
            <div
              className={`rating-badge shrink-0 w-12 h-12 text-lg ${getRatingColor(last.rating)}`}
              style={{
                color: getRatingHex(last.rating),
                borderColor: getRatingHex(last.rating),
              }}
            >
              {formatRating(last.rating)}
            </div>
          </div>

          {/* The next move, spelled out — the big button is "keep going". */}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={keepGoing} className="btn-y2k btn-y2k-primary" autoFocus>
              {t("reviewAnother")}
            </button>
            {last.slug && (
              <Link href={`/reviews/${last.slug}`} className="btn-y2k btn-y2k-outline">
                {t("seeReview")}
              </Link>
            )}
            <Link href="/reviews/mine" className="btn-y2k btn-y2k-outline">
              {t("done")}
            </Link>
          </div>

          {/* More from the same artist — one tap starts the next review. */}
          {moreFrom && (
            <div className="space-y-2 border-t border-border-subtle pt-4">
              <p className="label-xbox">{t("moreFrom", { artist: moreFrom.artist })}</p>
              <p className="text-xs text-text-muted">{t("moreFromHint")}</p>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                {moreFrom.results.map((r) => {
                  const key = `${r.source}:${r.id}`;
                  return (
                    <div key={key} className="w-24 shrink-0">
                      <div className="relative w-24 h-24">
                        <button
                          type="button"
                          onClick={() => startNext(r)}
                          disabled={startingNext !== null}
                          className={`block w-full h-full rounded-md overflow-hidden border bg-bg-elevated transition-transform active:scale-95 disabled:opacity-60 ${
                            startingNext === key
                              ? "border-accent-primary animate-pulse"
                              : "border-white/10 hover:border-[rgba(var(--accent-rgb),0.6)]"
                          }`}
                          aria-label={t("reviewThis", { title: r.title })}
                        >
                          {r.cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-2xl">💿</span>
                          )}
                        </button>
                        <span className="absolute bottom-1 right-1">
                          <PreviewButton
                            previewKey={key}
                            src={{ source: r.source, id: r.id, title: r.title, artist: r.artist }}
                            label={r.title}
                          />
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-text-primary line-clamp-2 leading-snug">
                        {r.title}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {[r.year, typeof r.avg_rating === "number" ? `★ ${formatRating(r.avg_rating)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="pixel-text text-xs text-text-muted">
            {t("streakCount", { n: streak.length })}
          </p>
        </div>
      )}

      {!posted && (
      <>
      {/* The streak strip — what you just published, everything from
          this sitting, and the one way out (DONE → My Stuff). */}
      {last && (
        <div className="panel-xbox p-4 space-y-3 border-[rgba(var(--accent-rgb),0.4)]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md overflow-hidden border border-white/10 bg-bg-elevated shrink-0">
              {last.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={last.cover}
                  alt={tc("coverAlt", { title: last.title })}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-lg">
                  💿
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="label-xbox text-accent-primary">{t("published")} ✓</p>
              <p className="font-[family-name:var(--font-heading)] font-bold text-text-primary truncate">
                {last.title}
              </p>
            </div>
            <div
              className={`rating-badge shrink-0 w-10 h-10 text-base ${getRatingColor(last.rating)}`}
              style={{
                color: getRatingHex(last.rating),
                borderColor: getRatingHex(last.rating),
              }}
            >
              {formatRating(last.rating)}
            </div>
            {last.slug && (
              <Link
                href={`/reviews/${last.slug}`}
                className="label-xbox hover:text-accent-primary transition-colors text-[0.65rem] shrink-0"
              >
                {t("view")}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap border-t border-border-subtle pt-3">
            <span className="pixel-text text-xs text-text-muted shrink-0">
              {t("streakCount", { n: streak.length })}
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {streak.map((r, i) => (
                <div
                  key={`${r.slug}-${i}`}
                  title={`${r.title} · ${formatRating(r.rating)}`}
                  className="w-7 h-7 rounded overflow-hidden border border-white/10 bg-bg-elevated"
                >
                  {r.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-xs">
                      💿
                    </span>
                  )}
                </div>
              ))}
            </div>
            <Link
              href="/reviews/mine"
              className="label-xbox hover:text-accent-primary transition-colors text-[0.65rem] ml-auto shrink-0"
            >
              {t("done")} →
            </Link>
          </div>
        </div>
      )}

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

      {/* ========== THE RELEASE (search) ==========
          Until a record is picked, the search is the whole screen.
          overflow-visible: this panel hosts the search dropdown —
          the panel's default overflow:hidden would clip the list. */}
      {!release && (
        <fieldset className="panel-xbox overflow-visible p-5 space-y-4">
          <legend className="label-xbox">{t("theRelease")}</legend>
          <CatalogSearch
            onPick={handlePick}
            autoFocus
            placeholder={t("searchPlaceholder")}
          />
          <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
            {t("tiedNote")}
          </p>
          {/* The door for releases the search can't reach (Luca
              2026-09-02): Bandcamp-only records, private-press stuff,
              regional catalogs, anything neither Spotify nor Genius
              carries. Staff import those by hand through the admin
              tool's Manual tab, so the ask is one email. */}
          {mode === "create" && (
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
      )}

      {/* ========== THE RATING SCREEN (Luca 2026-10-24) ==========
          One screen, no stacked boxes. Phones: a single column in the
          order release → switch → score → songs → words → post (in
          song-by-song mode the album score drops below the songs, since
          it comes from them). Desktop (lg): two columns — the record and
          the score on the left like the release page, the switch, songs
          and words on the right. The right column's wrapper is
          display:contents on phones so its pieces can interleave with
          the left ones via `order`. */}
      {release && (
        <div className="rate-sheet flex flex-col gap-5 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-6 lg:items-start">
          {/* The record */}
          <div className="order-1 lg:col-start-1 lg:row-start-1 flex items-center gap-4 lg:block">
            {/* ▶ on the cover for "wait, how does it go?" — an album
                plays its first song; every song row has its own ▶. */}
            <div className="relative w-16 h-16 lg:w-full lg:h-auto lg:aspect-square shrink-0">
              <div className="w-full h-full rounded-lg overflow-hidden border border-white/10 bg-bg-elevated rate-cover">
                {release.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={release.cover_image}
                    alt={tc("coverAlt", { title: release.title })}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-2xl">💿</span>
                )}
              </div>
              <span className="absolute -bottom-1.5 -right-1.5 lg:bottom-2 lg:right-2">
                <PreviewButton
                  previewKey={`local:${release.id}`}
                  src={{ source: "local", id: release.id }}
                  label={release.title}
                />
              </span>
            </div>
            <div className="min-w-0 flex-1 lg:mt-5">
              <p className="font-[family-name:var(--font-heading)] font-bold text-text-primary truncate text-lg lg:text-3xl lg:whitespace-normal lg:leading-tight">
                {release.title}
              </p>
              <p className="text-sm lg:text-base text-text-secondary truncate">
                {pickedArtist}
                {year ? ` · ${year}` : ""} · {release.release_type}
              </p>
              {release.is_unreleased && (
                <span className="pixel-text text-[10px] text-osd-amber border border-osd-amber/40 rounded px-1 py-0.5 inline-block mt-1">
                  {t("unreleasedStamp")}
                </span>
              )}
              {/* Release is only swappable while creating. */}
              {mode === "create" && (
                <button
                  type="button"
                  onClick={() => {
                    setRelease(null);
                    setPickedTracks(new Set());
                    setScoreMode("album");
                    setOwnScore(false);
                  }}
                  className="label-xbox hover:text-accent-primary transition-colors text-[0.65rem] mt-1 lg:mt-3 block"
                >
                  {t("change")}
                </button>
              )}
            </div>
          </div>

          {/* The score — "whole album": the big number + the slider (tap
              or slide anywhere on it — option A of the mockups Luca tried,
              2026-10-24).
              "Song by song": the songs' average, or their own number. */}
          <div
            className={`${songsMode ? "order-5" : "order-3"} lg:col-start-1 lg:row-start-2 space-y-2`}
          >
            <p className="label-xbox">{songsMode ? t("albumScore") : t("yourRating")}</p>
            {songsMode ? (
              <>
                <ScoreNumber
                  value={ownScore ? rating : songAverage}
                  typeLabel={t("typeScore")}
                  onChange={(v) => {
                    setOwnScore(true);
                    setRating(v);
                  }}
                />
                <p className="text-xs text-text-muted">
                  {ownScore
                    ? songAverage !== null
                      ? t("avgCompare", { avg: formatRating(songAverage) })
                      : t("avgNone")
                    : songAverage !== null
                      ? t("avgOf", { n: ratedSongs.length })
                      : t("avgNone")}
                </p>
                <div className="rate-seg" role="radiogroup" aria-label={t("albumScore")}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!ownScore}
                    className={!ownScore ? "is-on" : ""}
                    onClick={() => setOwnScore(false)}
                  >
                    {/* "Use average", not "Use 8.8" — the number is already shown
                        above (Luca 2026-10-24: "doesn't make any sense") */}
                    {t("useAverage")}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={ownScore}
                    className={ownScore ? "is-on" : ""}
                    onClick={() => setOwnScore(true)}
                  >
                    {t("setOwn")}
                  </button>
                </div>
                {ownScore && (
                  <ScoreSlider
                    value={rating}
                    onChange={setRating}
                    ariaLabel={t("ratingAria")}
                    scale
                  />
                )}
              </>
            ) : (
              <>
                <ScoreNumber value={rating} onChange={setRating} typeLabel={t("typeScore")} />
                <ScoreSlider
                  value={rating}
                  onChange={setRating}
                  ariaLabel={t("ratingAria")}
                  scale
                />
                <p className="text-xs text-text-muted">{t("rulerHint")}</p>
              </>
            )}
          </div>

          {/* Right column on desktop; on phones its pieces interleave. */}
          <div className="contents lg:block lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:space-y-6">
            {canScoreSongs && (
              <div className="order-2 rate-seg" role="radiogroup" aria-label={t("modeAria")}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!songsMode}
                  className={!songsMode ? "is-on" : ""}
                  onClick={() => setScoreMode("album")}
                >
                  {t("modeAlbum")}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={songsMode}
                  className={songsMode ? "is-on" : ""}
                  onClick={() => setScoreMode("songs")}
                >
                  {t("modeSongs")}
                </button>
              </div>
            )}

            {/* The songs. Song by song: every row is a slider. Whole
                album: the same rows for ♥ favourites + ▶ previews. */}
            {tracks.length > 0 && (
              <div className="order-4 space-y-2">
                {songsMode ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-text-secondary">
                        {t.rich("ratedOf", {
                          n: ratedSongs.length,
                          total: tracks.length,
                          b: (chunks) => <b className="text-text-primary">{chunks}</b>,
                        })}
                      </span>
                      <span className="text-xs text-text-muted text-right">{t("songsHint")}</span>
                    </div>
                    <div className="rate-progress">
                      <i style={{ width: `${(ratedSongs.length / tracks.length) * 100}%` }} />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="label-xbox">{t("favorites")}</p>
                    <p className="text-xs text-text-muted">
                      {t("favoritesHint")}
                    </p>
                  </>
                )}
                <div className={songsMode ? "" : "max-h-80 overflow-y-auto pr-1"}>
                  <TrackScoreList
                    releaseId={release.id}
                    tracks={tracks}
                    rateable={songsMode}
                    scores={trackScores}
                    onScore={scoreTrack}
                    favorites={pickedTracks}
                    onToggleFavorite={toggleTrack}
                    labels={{
                      favorite: t("favorite"),
                      typeScore: t("typeScore"),
                      clear: t("clearHint"),
                    }}
                  />
                </div>
              </div>
            )}

            {/* Their words — all optional. */}
            <div className="order-6 space-y-4">
              <FormField label={t("oneLiner", { n: snippet.length })}>
                <input
                  type="text"
                  value={snippet}
                  onChange={(e) => setSnippet(e.target.value.slice(0, 200))}
                  placeholder={t("oneLinerPlaceholder")}
                  maxLength={200}
                  className="form-input"
                />
                <p className="text-xs text-text-muted mt-1">{t("oneLinerHint")}</p>
              </FormField>

              <FormField label={t("fullReview", { n: summary.length })}>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value.slice(0, 10000))}
                  placeholder={t("fullPlaceholder")}
                  rows={8}
                  maxLength={10000}
                  className="form-input resize-none"
                />
              </FormField>

              {/* GIF reaction — sits at the bottom of the review, exactly
                  where it shows on the review page. Hidden entirely until
                  a KLIPY key is configured (GifAttach renders null). */}
              {KLIPY_APP_KEY && (
                <FormField label={t("gifLabel")}>
                  <GifAttach gif={gif} onChange={setGif} />
                  <p className="text-xs text-text-muted mt-1">{t("gifHint")}</p>
                </FormField>
              )}
            </div>

            {error && (
              <div className="order-7 panel-xbox p-4 border-red-500/30 bg-red-500/5">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="order-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="btn-y2k btn-y2k-primary disabled:opacity-50"
              >
                {saving ? tc("saving") : mode === "edit" ? t("updatePublish") : t("publish")}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="btn-y2k btn-y2k-outline disabled:opacity-50"
              >
                {saving ? tc("saving") : t("saveDraft")}
              </button>
              <button type="button" onClick={() => router.back()} className="btn-y2k btn-y2k-outline">
                {tc("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
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
