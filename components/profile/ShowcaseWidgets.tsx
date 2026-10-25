/**
 * ShowcaseWidgets — the small, "live" profile showcases as tinted
 * widgets (Luca 2026-10-24, showcases overhaul round 2: "a mix of B
 * and C"). This file holds the grid itself plus the widgets that need
 * no slow data: Ratings, Taste match and the owner's "＋ Add a
 * showcase" hint. On rotation / All-time listening (stats.fm) live in
 * ListeningShowcase.tsx and Song of the day in SongOfDayShowcase.tsx —
 * they stream in behind Suspense but render the same widget shell.
 *
 * The look (from mockup C, "Widgets"): tiles in a two-column grid, each
 * tinted with its own colour, NO borders, no big VHS heading — the
 * small OSD label inside the tile says what it is. A wide tile spans
 * both columns. Scores always sit in the site's rating badge.
 *
 * Empty widgets render nothing (visitors never see a NO SIGNAL box), so
 * the grid simply closes up around whatever is left.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatRating, getRatingColor, getRatingHex } from "@/lib/rating";
import type { TasteMatch } from "@/lib/db/showcases";

/** The grid. Children are widgets; null children leave no gap. */
export function WidgetGrid({ children }: { children: React.ReactNode }) {
  return <div className="sc-widgets">{children}</div>;
}

/** Shared tile shell — `tint` picks the colour, `wide` spans both columns. */
export function Widget({
  tint,
  wide = false,
  label,
  labelExtra,
  children,
  className = "",
}: {
  tint: "rate" | "sotd" | "rotation" | "listen" | "match";
  wide?: boolean;
  label: string;
  /** Anything that sits at the right end of the label row (stats.fm ↗,
      the streak count…). */
  labelExtra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`sc-widget sc-tint-${tint}${wide ? " is-wide" : " is-half"} ${className}`}>
      <div className="sc-widget-label">
        <span>{label}</span>
        {labelExtra}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------
   RATINGS — the average in a rating badge, "Average of all N
   reviews", and a real bar chart of how the ratings spread
   (Luca 2026-10-25: the old row of dots "meant nothing").

   11 bars, one per whole score: 0–0.9, 1–1.9 … 9–9.9, and a perfect
   10 on its own (it has its own colour on the site). Each bar wears
   the rating colour of its score, its height is its share of the
   busiest bar, and the busiest bar carries its count on top. A thin
   line marks where the average falls. Empty scores keep a faint stub
   so the 0–10 scale always reads the same width.
   ------------------------------------------------------------ */
export function RatingsWidget({ ratings }: { ratings: number[] }) {
  const t = useTranslations("profile.sc");
  const valid = ratings.filter((r) => Number.isFinite(r));
  if (valid.length === 0) return null; // nothing to say yet
  const avg = Math.round((valid.reduce((s, r) => s + r, 0) / valid.length) * 10) / 10;

  const bins = Array<number>(11).fill(0);
  for (const r of valid) bins[Math.min(10, Math.floor(Math.max(0, r)))] += 1;
  const peak = Math.max(...bins);
  // Where the average sits across the 11 columns: column i spans
  // i/11 → (i+1)/11, so 8.4 lands 40% into the "8" column. A 10.0
  // average sits in the middle of the "10" column.
  const avgLeft = ((avg >= 10 ? 10.5 : avg) / 11) * 100;

  return (
    <Widget tint="rate" label={t("ratings")}>
      <div className="sc-rate-head">
        <span className={`rating-badge sc-widget-badge ${getRatingColor(avg)}`}>
          {formatRating(avg)}
        </span>
        <span className="sc-widget-sub">{t("averageOf", { n: valid.length })}</span>
      </div>
      <div className="sc-hist" aria-hidden="true">
        <div className="sc-hist-bars">
          {bins.map((n, i) => (
            <span
              key={i}
              className="sc-hist-col"
              title={`${i === 10 ? "10" : `${i}–${i}.9`}: ${n}`}
            >
              {n > 0 && n === peak && <em>{n}</em>}
              <i
                className={n === 0 ? "is-empty" : undefined}
                style={
                  n > 0
                    ? {
                        height: `${Math.max(10, (n / peak) * 100)}%`,
                        background: getRatingHex(i),
                        animationDelay: `${i * 35}ms`,
                      }
                    : undefined
                }
              />
            </span>
          ))}
          <b className="sc-hist-avg" style={{ left: `${avgLeft}%` }} />
        </div>
        {/* 0 / 5 / 10 under the middle of their columns */}
        <div className="sc-hist-axis">
          <span style={{ left: `${(0.5 / 11) * 100}%` }}>0</span>
          <span style={{ left: `${(5.5 / 11) * 100}%` }}>5</span>
          <span style={{ left: `${(10.5 / 11) * 100}%` }}>10</span>
        </div>
      </div>
    </Widget>
  );
}

/* ------------------------------------------------------------
   TASTE MATCH — only ever rendered for a signed-in visitor (the
   page decides), never on your own profile. Both avatars, the %, a
   thin meter and one plain line about the record you agree on most.
   ------------------------------------------------------------ */
export function TasteMatchWidget({
  match,
  ownerName,
  ownerAvatar,
  viewerAvatar,
  viewerInitial,
}: {
  match: TasteMatch;
  ownerName: string;
  ownerAvatar: string | null;
  viewerAvatar: string | null;
  viewerInitial: string;
}) {
  const t = useTranslations("profile.sc");
  const { pick } = match;
  const line =
    pick.mine === pick.theirs
      ? t("tasteBoth", { title: pick.title, score: formatRating(pick.mine) })
      : t("tasteClose", {
          title: pick.title,
          mine: formatRating(pick.mine),
          theirs: formatRating(pick.theirs),
        });
  // Only https or site-relative avatar URLs go into an <img>.
  const safe = (u: string | null) =>
    u && (u.startsWith("https://") || u.startsWith("/")) ? u : null;
  const owner = safe(ownerAvatar);
  const viewer = safe(viewerAvatar);

  return (
    <div className="sc-widget sc-tint-match is-wide is-row">
      <div className="sc-pair" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {owner ? <img src={owner} alt="" /> : <span>{ownerName[0]?.toUpperCase()}</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {viewer ? <img src={viewer} alt="" /> : <span>{viewerInitial}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="sc-widget-label">
          <span>{t("tasteMatch", { name: ownerName })}</span>
        </div>
        <p className="sc-widget-big">{match.percent}%</p>
        <span className="sc-meter" aria-hidden="true">
          <i style={{ width: `${match.percent}%` }} />
        </span>
        <p className="sc-widget-sub sc-wrap">
          {line} · {t("tasteCommon", { n: match.common })}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   The owner's "＋ Add a showcase" — a slim dashed strip under the
   widgets that opens Settings. Visitors never get it.
   ------------------------------------------------------------ */
export function AddShowcaseHint() {
  const t = useTranslations("profile.sc");
  return (
    <Link href="/settings/profile" className="sc-add-hint">
      <span>{t("addShowcase")}</span>
      <small>{t("onlyYou")}</small>
    </Link>
  );
}

/** The ♥ — the same SVG heart as the rating page's song rows
    (TrackScoreList), so it fills at one size everywhere. */
export function LovedHeart({ label }: { label: string }) {
  return (
    <svg className="sc-heart" viewBox="0 0 24 24" role="img" aria-label={label}>
      <path d="M12 20.5s-7.5-4.6-9.3-9.3C1.4 7.8 3.6 4.5 7 4.5c2.1 0 3.8 1.2 5 3 1.2-1.8 2.9-3 5-3 3.4 0 5.6 3.3 4.3 6.7-1.8 4.7-9.3 9.3-9.3 9.3z" />
    </svg>
  );
}
