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
   RATINGS — replaces the old full-width histogram ("the rating
   chart takes a whole screen to say one number"): the average in a
   rating badge, how many records, and one row of dots along a 0–10
   line, one dot per rating, stacked where ratings pile up.
   ------------------------------------------------------------ */
export function RatingsWidget({ ratings }: { ratings: number[] }) {
  const t = useTranslations("profile.sc");
  const valid = ratings.filter((r) => Number.isFinite(r));
  if (valid.length === 0) return null; // nothing to say yet
  const avg = Math.round((valid.reduce((s, r) => s + r, 0) / valid.length) * 10) / 10;

  // One dot per rating, bucketed to the half point so equal-ish
  // ratings stack upward instead of hiding behind each other. Stacks
  // cap at 4 dots so a big profile can't grow the tile.
  const stacks = new Map<number, number>();
  const dots: { left: number; level: number; color: string }[] = [];
  for (const r of valid) {
    const bucket = Math.round(Math.min(10, Math.max(0, r)) * 2) / 2;
    const level = stacks.get(bucket) ?? 0;
    stacks.set(bucket, level + 1);
    if (level < 4) dots.push({ left: bucket * 10, level, color: getRatingHex(bucket) });
  }

  return (
    <Widget tint="rate" label={t("ratings")}>
      <span className={`rating-badge sc-widget-badge ${getRatingColor(avg)}`}>
        {formatRating(avg)}
      </span>
      <span className="sc-widget-sub">{t("averageOf", { n: valid.length })}</span>
      <div className="sc-dots" aria-hidden="true">
        {dots.map((d, i) => (
          <i
            key={i}
            style={{
              left: `${d.left}%`,
              bottom: `${d.level * 8}px`,
              background: d.color,
            }}
          />
        ))}
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
