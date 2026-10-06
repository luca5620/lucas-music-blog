"use client";

/**
 * FirstRatings — the /start screen's moving parts (2026-10-05).
 *
 * The job: a brand-new member rates three records they already know in
 * about a minute, so their profile, Your Taste and the home page stop
 * being empty the moment they arrive. (36 sign-ups in 30 days, 7
 * reviews ever — the home page promises "your first rating takes two
 * taps"; this is what makes that true.)
 *
 *   tap a cover  →  slide to a score  →  SAVE        (×3, skips allowed)
 *
 * FIRST-RUN ONLY — NOT A SECOND WAY TO REVIEW. Quick Rate (a deck that
 * did exactly this for anyone, any time) was rejected on 2026-09-08 for
 * being a parallel review flow. This screen is onboarding: the page
 * refuses anyone with 3+ published reviews, nothing links here once
 * the shelf has a record on it, and when the three are done it hands
 * over to the ONE real flow (/reviews/new, whose "rate another" loop
 * is the backfill tool) instead of offering more cards.
 *
 * What gets saved is an ordinary review: POST /api/reviews with
 * { release_id, rating, is_published: true, local_date } and NO words.
 * The API has a wordless-rating rate-limit lane for exactly this
 * (60 / 5 min), and is_published defaults to FALSE — leave it out
 * and the rating silently becomes a draft nobody sees.
 *
 * The rating widget is the review form's own slider (`rating-slider`
 * + the rating-badge readout, lib/rating.ts colours) — deliberately
 * not a new widget, so a score means the same thing everywhere.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTranslations } from "next-intl";
import CatalogSearch, { type CatalogPick } from "@/components/catalog/CatalogSearch";
import { getRatingHex, getRatingColor, formatRating } from "@/lib/rating";
import { hapticTap } from "@/lib/native";
import { smallCover } from "@/lib/images";
import { FIRST_RATINGS_GOAL } from "@/lib/onboarding";
import type { StarterPick } from "@/lib/db/onboarding";
// The device's own calendar day, sent as local_date so each rating
// lands on the right day of THE LOG (see lib/review-date.ts).
import { localDateString } from "@/lib/review-date";

/** A tile on the grid: a starter pick, or a record found via search
    (which may have no cover — the tile shows a disc instead). */
type Pick = Omit<StarterPick, "cover_image"> & { cover_image: string | null };

/** Where the slider starts — same as the review form. */
const DEFAULT_RATING = 7;

interface FirstRatingsProps {
  /** The grid — already minus anything this member has reviewed. */
  picks: StarterPick[];
  /** Where "Skip" / "Go home" lead (same-site path, already checked). */
  next: string;
  /** For the "See your shelf" link; null if the profile didn't load. */
  username: string | null;
  /** Published reviews they already had — they count toward the 3. */
  startCount: number;
}

export default function FirstRatings({ picks, next, username, startCount }: FirstRatingsProps) {
  // LANGUAGES: every word here comes from messages → "start".
  const t = useTranslations("start");

  // Records pulled in through the search box ride at the FRONT of the
  // grid, so the one you just looked for is the first thing you see.
  const [searched, setSearched] = useState<Pick[]>([]);
  // releaseId → the score they saved. Saved tiles stay on the grid
  // with their number on them (the shelf filling up IS the progress).
  const [rated, setRated] = useState<Map<string, number>>(new Map());
  // "Haven't heard it" — dimmed and untappable, so the grid shows
  // what's left without reshuffling under their thumb.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  // The record in the rating sheet (null = sheet closed).
  const [active, setActive] = useState<Pick | null>(null);
  // Two-phase close so the sheet slides away instead of popping
  // (same pattern as components/ui/CreateSheet).
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rating, setRating] = useState(DEFAULT_RATING);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = startCount + rated.size;
  const done = count >= FIRST_RATINGS_GOAL;

  /* ── Mark "seen" the moment the screen opens ──
     The automatic routing (lib/onboarding.ts) is once per account, so
     opening this screen — not finishing it — is what counts. Stamps
     profiles.onboarded_at (migration 056) + a cookie. Fire and forget:
     if it fails, the worst case is seeing this screen once more. The
     ref guards React's dev-mode double effect. */
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    void fetch("/api/onboarding", { method: "POST" }).catch(() => {});
  }, []);

  const grid: Pick[] = [
    ...searched,
    ...picks.filter((p) => !searched.some((s) => s.id === p.id)),
  ];

  function openRater(pick: Pick) {
    if (rated.has(pick.id) || skipped.has(pick.id) || done) return;
    hapticTap();
    setError(null);
    setRating(DEFAULT_RATING);
    setActive(pick);
    setSheetOpen(true);
  }

  function closeRater() {
    setSheetOpen(false);
    setError(null);
  }

  function notHeard() {
    if (active) setSkipped((prev) => new Set(prev).add(active.id));
    closeRater();
  }

  /** A record picked in the search box → straight into the sheet. */
  function onSearchPick({ release, artist_name }: CatalogPick) {
    const pick: Pick = {
      id: release.id,
      slug: release.slug,
      title: release.title,
      artist: artist_name,
      cover_image: release.cover_image,
      year: release.release_date ? release.release_date.slice(0, 4) : null,
    };
    setSearched((prev) => [pick, ...prev.filter((p) => p.id !== pick.id)]);
    // Searching for it again after "haven't heard it" means they have.
    setSkipped((prev) => {
      if (!prev.has(pick.id)) return prev;
      const nextSet = new Set(prev);
      nextSet.delete(pick.id);
      return nextSet;
    });
    if (!rated.has(pick.id)) {
      setError(null);
      setRating(DEFAULT_RATING);
      setActive(pick);
      setSheetOpen(true);
    }
  }

  async function save() {
    if (!active || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          release_id: active.id,
          rating,
          // MUST be sent: the API defaults to a draft.
          is_published: true,
          local_date: localDateString(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (res.status === 409) {
        // They already have a review of this record (maybe a draft).
        // Not an error worth a red box — dim the tile and move on.
        setSkipped((prev) => new Set(prev).add(active.id));
        setError(t("already"));
        setSaving(false);
        return;
      }
      if (!res.ok) {
        // The API's own message comes back in the member's language.
        setError(data.error ?? t("failed"));
        setSaving(false);
        return;
      }

      hapticTap();
      setRated((prev) => new Map(prev).set(active.id, rating));
      setSaving(false);
      closeRater();
      // That was the last one → the grid folds away and the finish
      // panel takes over the top of the page; bring it into view so
      // the celebration isn't happening off-screen.
      if (count + 1 >= FIRST_RATINGS_GOAL) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setError(t("failed"));
      setSaving(false);
    }
  }

  const ratingColor = getRatingHex(rating);
  const ratedPicks = grid.filter((p) => rated.has(p.id));

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* ===== Header — an OSD title card with the tape counter ===== */}
      <section className="panel-xbox-glow p-5 sm:p-7 relative overflow-hidden">
        <div className="space-y-3 text-center sm:text-left">
          <p className="osd-text text-xs">{done ? t("doneEyebrow") : t("eyebrow")}</p>
          <h1 className="crt-title text-2xl sm:text-4xl">
            {done ? t("doneTitle") : t("title", { goal: FIRST_RATINGS_GOAL })}
          </h1>
          <p className="hero-copy text-sm max-w-xl mx-auto sm:mx-0">
            {done ? t("doneBody") : t("sub")}
          </p>

          {/* Progress — three tape cells that light up as they fill.
              role=progressbar so a screen reader hears "1 of 3". */}
          <div
            className="flex items-center justify-center sm:justify-start gap-3 pt-1"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={FIRST_RATINGS_GOAL}
            aria-valuenow={Math.min(count, FIRST_RATINGS_GOAL)}
            aria-label={t("progressAria", { n: Math.min(count, FIRST_RATINGS_GOAL), goal: FIRST_RATINGS_GOAL })}
          >
            <span className="flex gap-1.5" aria-hidden="true">
              {Array.from({ length: FIRST_RATINGS_GOAL }, (_, i) => (
                <span
                  key={i}
                  className={`first-run-cell ${i < count ? "first-run-cell-on" : ""}`}
                />
              ))}
            </span>
            <span className="osd-text text-sm tabular-nums">
              {t("progress", { n: Math.min(count, FIRST_RATINGS_GOAL), goal: FIRST_RATINGS_GOAL })}
            </span>
          </div>

          {/* Done → the celebratory moment + where to go next. The
              shelf link is the payoff: their profile is no longer a
              wall of NO SIGNAL. "Rate more" hands over to the ONE real
              review flow — this screen never offers a fourth card. */}
          {done ? (
            <div className="first-run-flash space-y-4 pt-2">
              {ratedPicks.length > 0 && (
                <div className="flex justify-center sm:justify-start gap-2">
                  {ratedPicks.slice(0, 5).map((p) => (
                    <span key={p.id} className="poster w-16 sm:w-20 shrink-0">
                      {p.cover_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={smallCover(p.cover_image)} alt={t("coverAlt", { title: p.title })} />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-2xl">💿</span>
                      )}
                      <span
                        className="poster-rating"
                        style={{ color: getRatingHex(rated.get(p.id)!), borderColor: `${getRatingHex(rated.get(p.id)!)}80` }}
                      >
                        {formatRating(rated.get(p.id)!)}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start">
                {username && (
                  <Link href={`/profile/${username}`} className="btn-y2k btn-y2k-primary justify-center">
                    {t("seeShelf")}
                  </Link>
                )}
                <Link href="/reviews/new" className="btn-y2k btn-y2k-outline justify-center">
                  {t("rateMore")}
                </Link>
                <Link href={next} className="btn-y2k btn-y2k-outline justify-center">
                  {t("goHome")}
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-center sm:text-left">
              {/* Skipping is always allowed — this is an invitation,
                  not a wall between them and the site. */}
              <Link
                href={next}
                className="pixel-text text-[11px] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors"
              >
                {t("skip")} →
              </Link>
            </p>
          )}
        </div>
        <div className="scan-bar" />
      </section>

      {!done && (
        <>
          {/* ===== Search — for the record that isn't on the grid ===== */}
          <section className="panel-xbox p-4">
            <CatalogSearch
              onPick={onSearchPick}
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
            />
          </section>

          {/* ===== The grid ===== */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="vhs-label text-sm">{t("gridLabel")}</span>
              <div className="flex-1 divider-glow" />
            </div>

            {grid.length === 0 ? (
              <div className="panel-xbox p-6 text-center">
                <p className="osd-text text-sm opacity-70">{t("empty")}</p>
              </div>
            ) : (
              // 3 across on a phone — big enough to recognise a cover
              // at a glance, which is the whole trick.
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {grid.map((p) => {
                  const score = rated.get(p.id);
                  const isSkipped = skipped.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openRater(p)}
                      disabled={score !== undefined || isSkipped}
                      className={`group text-left space-y-1 ${isSkipped ? "opacity-30" : ""}`}
                      aria-label={
                        score !== undefined
                          ? t("ratedAria", { title: p.title, rating: formatRating(score) })
                          : t("tileAria", { title: p.title, artist: p.artist })
                      }
                    >
                      <span className={`poster ${score !== undefined ? "first-run-rated" : ""}`}>
                        {p.cover_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={smallCover(p.cover_image)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-3xl">💿</span>
                        )}
                        {score !== undefined && (
                          <>
                            <span className="first-run-rated-tag osd-text">{t("rated")}</span>
                            <span
                              className="poster-rating"
                              style={{ color: getRatingHex(score), borderColor: `${getRatingHex(score)}80` }}
                            >
                              {formatRating(score)}
                            </span>
                          </>
                        )}
                      </span>
                      <span className="block text-[11px] sm:text-xs font-bold text-text-primary truncate font-[family-name:var(--font-heading)] group-hover:text-accent-primary transition-colors">
                        {p.title}
                      </span>
                      <span className="block text-[10px] sm:text-[11px] text-text-secondary truncate">
                        {p.artist}
                        {p.year ? ` · ${p.year}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* ===== The rating sheet ===== */}
      {active && (
        <RaterSheet
          open={sheetOpen}
          onClosed={() => setActive(null)}
          onClose={closeRater}
          label={t("sheetLabel")}
          closeLabel={t("close")}
        >
          <div className="flex items-center gap-3">
            <span className="poster w-16 shrink-0">
              {active.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={smallCover(active.cover_image)} alt={t("coverAlt", { title: active.title })} />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-2xl">💿</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-base font-bold text-text-primary truncate font-[family-name:var(--font-heading)]">
                {active.title}
              </span>
              <span className="block text-sm text-text-secondary truncate">
                {active.artist}
                {active.year ? ` · ${active.year}` : ""}
              </span>
            </span>
          </div>

          {/* Same readout + slider markup as ReviewForm's VERDICT step —
              keep them in step if that one changes. */}
          <div className="flex items-center gap-5">
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
                  // One haptic tick per 0.1 step on the phone, no-op on web.
                  hapticTap();
                  setRating(parseFloat(e.target.value));
                }}
                className={`rating-slider${
                  rating === 10 ? " rating-slider-perfect" : rating >= 9.5 ? " rating-slider-elite" : ""
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

          {error && <p className="text-xs text-accent-rose">{error}</p>}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={notHeard} className="btn-y2k btn-y2k-outline justify-center text-xs">
              {t("notHeard")}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-y2k btn-y2k-primary justify-center disabled:opacity-60"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </RaterSheet>
      )}
    </div>
  );
}

/**
 * The slide-up sheet the slider lives in. Portaled to document.body
 * (the CRT shell's stacking contexts trap position:fixed — standing
 * repo gotcha), same classes and two-phase close as CreateSheet, so it
 * sits above the app's tab bar and slides like every other sheet.
 */
function RaterSheet({
  open,
  onClose,
  onClosed,
  label,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Fires once the slide-down animation has finished. */
  onClosed: () => void;
  label: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  if (typeof document === "undefined") return null;
  const closing = !open;
  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[54] bg-black/60 ${closing ? "sheet-dim-out" : "sheet-dim-in"}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`live-sheet-fixed live-sheet-bottom live-sheet-pad ${closing ? "sheet-anim-out" : "sheet-anim-in"}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onAnimationEnd={(e) => {
          // Only the sheet's OWN slide — the slider thumb's glow
          // animation bubbles up here too.
          if (closing && e.target === e.currentTarget) onClosed();
        }}
      >
        <div className="mx-2 mb-2 max-w-md sm:mx-auto rounded-2xl bg-[#141418] border border-white/10 shadow-[0_-8px_40px_rgba(0,0,0,0.7)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="label-xbox">{label}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="w-7 h-7 rounded-full border border-white/10 text-text-muted hover:text-text-primary flex items-center justify-center text-sm"
            >
              ✕
            </button>
          </div>
          <div className="p-4 space-y-4">{children}</div>
        </div>
      </div>
    </>,
    document.body
  );
}
