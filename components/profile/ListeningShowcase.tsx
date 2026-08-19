/**
 * ListeningShowcase — "ON ROTATION" profile block.
 *
 * Shows what the profile owner is playing RIGHT NOW (or the last
 * track they streamed) plus their lifetime listening totals —
 * minutes listened and total streams — all pulled from their public
 * stats.fm profile. Zero setup beyond pasting the stats.fm link in
 * Settings; private/absent stats.fm data just renders less.
 *
 * Server component: data is fetched (and cached in lib/statsfm)
 * during the profile render, so there's nothing to poll client-side.
 */

import Link from "next/link";
import {
  parseStatsfmUsername,
  getListeningSnapshot,
} from "@/lib/statsfm";

interface Props {
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
  statsfmUrl,
  isOwner,
  accentColor,
}: Props) {
  const username = parseStatsfmUsername(statsfmUrl);

  // No stats.fm link: give the owner a setup nudge, show visitors nothing.
  if (!username) {
    if (!isOwner) return null;
    return (
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">ON ROTATION</div>
        <div className="panel-xbox p-5 text-sm text-text-secondary space-y-2">
          <p>
            Show what you&apos;re listening to and your lifetime minutes +
            streams here. Two steps:
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

  // Linked but nothing readable (private profile / no data yet).
  if (!track && !stats) {
    if (!isOwner) return null;
    return (
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">ON ROTATION</div>
        <div className="panel-xbox p-5 text-sm text-text-secondary">
          Couldn&apos;t read your stats.fm data — make sure your stats.fm
          profile is set to <span className="text-text-primary">public</span>{" "}
          (stats.fm app → Settings → Privacy). (Only you can see this hint.)
        </div>
      </section>
    );
  }

  const ago = track && !track.isPlaying ? timeAgo(track.endedAt) : null;

  return (
    <section className="space-y-3">
      <div className="vhs-label inline-block text-sm">ON ROTATION</div>
      <div className="panel-xbox p-5 space-y-5">
        {/* --- Now playing / last played --- */}
        {track && (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle shrink-0">
              {track.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={track.image}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-2xl">
                  💿
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="pixel-text text-xs uppercase tracking-widest mb-0.5">
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
              <p className="font-[family-name:var(--font-heading)] font-bold text-text-primary truncate">
                {track.name}
              </p>
              <p className="text-sm text-text-secondary truncate">
                {track.artists}
              </p>
            </div>
          </div>
        )}

        {/* --- Lifetime totals --- */}
        {stats && (
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <p
                className="font-[family-name:var(--font-heading)] text-3xl font-extrabold"
                style={{ color: accentColor }}
              >
                {fmt.format(stats.minutes)}
              </p>
              <p className="pixel-text text-xs text-text-muted uppercase tracking-widest mt-1">
                Minutes listened
              </p>
            </div>
            <div>
              <p
                className="font-[family-name:var(--font-heading)] text-3xl font-extrabold"
                style={{ color: accentColor }}
              >
                {fmt.format(stats.streams)}
              </p>
              <p className="pixel-text text-xs text-text-muted uppercase tracking-widest mt-1">
                Total streams
              </p>
            </div>
          </div>
        )}

        {/* Attribution + deep link */}
        <p className="text-right">
          <a
            href={statsfmUrl ?? "https://stats.fm"}
            target="_blank"
            rel="noopener noreferrer"
            className="pixel-text text-[10px] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors"
          >
            via stats.fm ↗
          </a>
        </p>
      </div>
    </section>
  );
}
