/**
 * ListeningShowcase — the two stats.fm-powered profile blocks.
 *
 * mode="track" → "ON ROTATION": what's playing right now (or the
 *                last stream), nothing else.
 * mode="stats" → "ALL-TIME LISTENING": lifetime minutes + streams.
 *
 * They're separate showcases so users can arrange (or skip) them
 * independently. Both read the user's public stats.fm profile via
 * the link Settings already collects; lib/statsfm caches so a
 * profile showing both doesn't fetch twice.
 */

import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  parseStatsfmUsername,
  getListeningSnapshot,
} from "@/lib/statsfm";

interface Props {
  mode: "track" | "stats";
  statsfmUrl: string | null;
  isOwner: boolean;
  accentColor: string;
}

/** Coarse "2h ago" formatting for the last-played timestamp. */
/** LANGUAGES: `t` is the profile.listening translator. */
type Translator = Awaited<ReturnType<typeof getTranslations>>;

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

export default async function ListeningShowcase({
  mode,
  statsfmUrl,
  isOwner,
  accentColor,
}: Props) {
  const t = await getTranslations("profile.listening");
  const locale = await getLocale();
  const fmt = new Intl.NumberFormat(locale);
  const label = mode === "track" ? t("onRotation") : t("allTime");
  const username = parseStatsfmUsername(statsfmUrl);

  // No stats.fm link: give the owner a setup nudge (once, on the
  // track block only so it isn't repeated), show visitors nothing.
  if (!username) {
    if (!isOwner || mode === "stats") return null;
    return (
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{label}</div>
        <div className="panel-xbox p-5 text-sm text-text-secondary space-y-2">
          <p>{t("setupIntro")}</p>
          <ol className="list-decimal pl-5 space-y-1 text-text-muted">
            <li>
              {t.rich("step1", {
                a: (chunks) => (
                  <a
                    href="https://stats.fm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-primary hover:text-accent-glow"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </li>
            <li>
              {t.rich("step2", {
                link: (chunks) => (
                  <Link
                    href="/settings/profile"
                    className="text-accent-primary hover:text-accent-glow"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </li>
          </ol>
          <p className="text-xs text-text-muted">{t("onlyYou")}</p>
        </div>
      </section>
    );
  }

  const { track, stats } = await getListeningSnapshot(username);

  /* ---------------- ON ROTATION — the track ---------------- */
  if (mode === "track") {
    if (!track) {
      if (!isOwner) return null;
      return (
        <section className="space-y-3">
          <div className="vhs-label inline-block text-sm">{label}</div>
          <div className="panel-xbox p-5 text-sm text-text-secondary">
            {t.rich("cantRead", {
              b: (chunks) => <span className="text-text-primary">{chunks}</span>,
            })}
          </div>
        </section>
      );
    }

    const ago = !track.isPlaying ? timeAgo(track.endedAt, t) : null;

    return (
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{label}</div>
        {/* Single compact row — cover, track info, attribution tucked
            in the corner. No dead vertical space. */}
        <div className="panel-xbox p-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded overflow-hidden bg-bg-elevated border border-border-subtle shrink-0">
            {track.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.image}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-xl">
                💿
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="pixel-text text-[11px] uppercase tracking-widest">
              {track.isPlaying ? (
                <span className="text-accent-primary">
                  <span className="animate-pulse">●</span> {t("listeningNow")}
                </span>
              ) : (
                <span className="text-text-muted">
                  {t("lastPlayed")}{ago ? ` · ${ago}` : ""}
                </span>
              )}
            </p>
            <p className="font-[family-name:var(--font-heading)] text-sm font-bold text-text-primary truncate">
              {track.name}
            </p>
            <p className="text-xs text-text-secondary truncate">
              {track.artists}
            </p>
          </div>

          <a
            href={statsfmUrl ?? "https://stats.fm"}
            target="_blank"
            rel="noopener noreferrer"
            className="pixel-text text-[10px] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors shrink-0 self-end"
          >
            stats.fm ↗
          </a>
        </div>
      </section>
    );
  }

  /* ------------- ALL-TIME LISTENING — the numbers ------------- */
  if (!stats) {
    if (!isOwner) return null;
    return (
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{label}</div>
        <div className="panel-xbox p-5 text-sm text-text-secondary">{t("noNumbers")}</div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="vhs-label inline-block text-sm">{label}</div>
      {/* Compact strip: both numbers on one row, attribution in the
          corner — sized to the two stats it holds, nothing more. */}
      <div className="panel-xbox p-3 flex items-end gap-6">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 flex-1">
          <p className="whitespace-nowrap">
            <span
              className="font-[family-name:var(--font-heading)] text-xl font-extrabold"
              style={{ color: accentColor }}
            >
              {fmt.format(stats.minutes)}
            </span>{" "}
            <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
              {t("minutes")}
            </span>
          </p>
          <p className="whitespace-nowrap">
            <span
              className="font-[family-name:var(--font-heading)] text-xl font-extrabold"
              style={{ color: accentColor }}
            >
              {fmt.format(stats.streams)}
            </span>{" "}
            <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
              {t("streams")}
            </span>
          </p>
        </div>
        <a
          href={statsfmUrl ?? "https://stats.fm"}
          target="_blank"
          rel="noopener noreferrer"
          className="pixel-text text-[10px] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors shrink-0"
        >
          stats.fm ↗
        </a>
      </div>
    </section>
  );
}
