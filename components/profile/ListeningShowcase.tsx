/**
 * ListeningShowcase — the two stats.fm-powered profile showcases,
 * drawn as WIDGETS since the showcases overhaul (Luca 2026-10-24,
 * round 2 "mix of B and C"): wide tinted tiles in the profile's widget
 * grid (ShowcaseWidgets.tsx), no panel, no VHS heading.
 *
 * mode="track" → "ON ROTATION": what's playing right now (or the
 *                last stream), nothing else.
 * mode="stats" → "ALL-TIME LISTENING": lifetime minutes + streams.
 *
 * They're separate showcases so users can arrange (or skip) them
 * independently. Both read the user's public stats.fm profile via
 * the link Settings already collects; lib/statsfm caches so a
 * profile showing both doesn't fetch twice.
 *
 * Visitors only ever see a filled widget. The owner gets a short
 * owner-only hint in the same tile when something's missing.
 */

import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  parseStatsfmUsername,
  getListeningSnapshot,
} from "@/lib/statsfm";
import { Widget } from "@/components/profile/ShowcaseWidgets";

interface Props {
  mode: "track" | "stats";
  statsfmUrl: string | null;
  isOwner: boolean;
}

/** LANGUAGES: `t` is the profile.listening translator. */
type Translator = Awaited<ReturnType<typeof getTranslations>>;

/** Coarse "2h ago" formatting for the last-played timestamp. */
function timeAgo(iso: string | null, t: Translator): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return t("minsAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  return t("daysAgo", { n: Math.floor(hours / 24) });
}

/** The little "stats.fm ↗" credit in the tile's label row. */
function Credit({ href }: { href: string | null }) {
  return (
    <a
      href={href ?? "https://stats.fm"}
      target="_blank"
      rel="noopener noreferrer"
      className="sc-widget-credit"
    >
      stats.fm ↗
    </a>
  );
}

export default async function ListeningShowcase({
  mode,
  statsfmUrl,
  isOwner,
}: Props) {
  const t = await getTranslations("profile.listening");
  const tsc = await getTranslations("profile.sc");
  const locale = await getLocale();
  const fmt = new Intl.NumberFormat(locale);
  const tint = mode === "track" ? "rotation" : "listen";
  const label = mode === "track" ? t("onRotation") : t("allTime");
  const username = parseStatsfmUsername(statsfmUrl);

  // No stats.fm link: a one-line setup nudge for the owner (on the
  // track tile only, so it isn't said twice); visitors see nothing.
  if (!username) {
    if (!isOwner || mode === "stats") return null;
    return (
      <Widget tint={tint} wide label={label}>
        <p className="sc-widget-sub sc-wrap">
          {tsc.rich("statsfmNudge", {
            link: (chunks) => (
              <Link href="/settings/profile" className="text-accent-primary hover:text-accent-glow">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </Widget>
    );
  }

  const { track, stats } = await getListeningSnapshot(username);

  /* ---------------- ON ROTATION — the track ---------------- */
  if (mode === "track") {
    if (!track) {
      if (!isOwner) return null;
      return (
        <Widget tint={tint} wide label={label}>
          <p className="sc-widget-sub sc-wrap">
            {t.rich("cantRead", {
              b: (chunks) => <span className="text-text-primary">{chunks}</span>,
            })}
          </p>
        </Widget>
      );
    }

    const ago = !track.isPlaying ? timeAgo(track.endedAt, t) : null;
    // Short enough for the label row: "● Listening now" while it's
    // playing, else "On rotation · 2h ago" (the "Last played" words cut
    // the label off on phones).
    const status = track.isPlaying ? t("listeningNow") : `${label}${ago ? ` · ${ago}` : ""}`;

    return (
      <div className="sc-widget sc-tint-rotation is-wide is-row">
        <span className="sc-widget-cover is-lg">
          {track.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.image} alt="" />
          ) : (
            <span>💿</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="sc-widget-label">
            <span>
              {/* the live dot only while it's actually playing */}
              {track.isPlaying && <span className="sc-live-dot" aria-hidden="true" />}
              {status}
            </span>
            <Credit href={statsfmUrl} />
          </div>
          <p className="sc-widget-title">{track.name}</p>
          <p className="sc-widget-sub">{track.artists}</p>
        </div>
      </div>
    );
  }

  /* ------------- ALL-TIME LISTENING — the numbers ------------- */
  if (!stats) {
    if (!isOwner) return null;
    return (
      <Widget tint={tint} wide label={label}>
        <p className="sc-widget-sub sc-wrap">{t("noNumbers")}</p>
      </Widget>
    );
  }

  return (
    <Widget tint={tint} wide label={label} labelExtra={<Credit href={statsfmUrl} />}>
      <p className="sc-widget-big">
        {fmt.format(stats.minutes)} <small>{t("minutes")}</small>
      </p>
      <p className="sc-widget-sub">
        {fmt.format(stats.streams)} {t("streams")}
      </p>
    </Widget>
  );
}
