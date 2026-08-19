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
function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const fmt = new Intl.NumberFormat("en-US");

export default async function ListeningShowcase({
  mode,
  statsfmUrl,
  isOwner,
  accentColor,
}: Props) {
  const label = mode === "track" ? "ON ROTATION" : "ALL-TIME LISTENING";
  const username = parseStatsfmUsername(statsfmUrl);

  // No stats.fm link: give the owner a setup nudge (once, on the
  // track block only so it isn't repeated), show visitors nothing.
  if (!username) {
    if (!isOwner || mode === "stats") return null;
    return (
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{label}</div>
        <div className="panel-xbox p-5 text-sm text-text-secondary space-y-2">
          <p>
            Show what you&apos;re listening to (and your lifetime minutes +
            streams) here. Two steps:
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-text-muted">
            <li>
              Make a free{" "}
              <a
                href="https://stats.fm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-primary hover:text-accent-glow"
              >
                stats.fm
              </a>{" "}
              account and connect your Spotify (set the profile to public).
            </li>
            <li>
              Paste your stats.fm link into{" "}
              <Link
                href="/settings/profile"
                className="text-accent-primary hover:text-accent-glow"
              >
                Settings → Links
              </Link>
              .
            </li>
          </ol>
          <p className="text-xs text-text-muted">
            (Only you can see this hint.)
          </p>
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
            Couldn&apos;t read your recent streams — make sure your stats.fm
            profile is <span className="text-text-primary">public</span>{" "}
            (stats.fm app → Settings → Privacy). (Only you can see this
            hint.)
          </div>
        </section>
      );
    }

    const ago = !track.isPlaying ? timeAgo(track.endedAt) : null;

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
                <span className="text-osd-green">
                  <span className="animate-pulse">●</span> Listening now
                </span>
              ) : (
                <span className="text-text-muted">
                  Last played{ago ? ` · ${ago}` : ""}
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
        <div className="panel-xbox p-5 text-sm text-text-secondary">
          No lifetime numbers yet — stats.fm needs your Spotify history
          imported (stats.fm app → Import) and your profile set to public.
          (Only you can see this hint.)
        </div>
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
              minutes
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
              streams
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
