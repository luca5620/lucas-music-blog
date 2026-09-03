"use client";

/**
 * UpcomingDropsClient — client half of the home DROPPING SOON module.
 *
 * Header matches the other home modules (label-xbox tag + big
 * font-heading title, ViewToggle, View All), and the listing follows
 * the same shared detailed/posters/compact preference as Latest
 * Drops and the Community Feed. The three views are countdown
 * flavors of ReleaseViews' layouts: every one keeps the live-ticking
 * clock (that's the whole module), and none of them show rating
 * stamps — the point here is the clock, not the score.
 *
 * Items linger for 24 hours after they drop (the clock reads OUT NOW
 * for that stretch) and sort behind anything still coming — see
 * listUpcomingReleases, which both this and the /releases shelf use.
 */

import Link from "next/link";
import { smallCover } from "@/lib/images";
import { formatDropDate } from "@/lib/upcoming";
import LiveCountdown from "@/components/releases/LiveCountdown";
import UpcomingDropBox from "@/components/home/UpcomingDropBox";
import { useReviewView, ViewToggle } from "@/components/reviews/ViewToggle";
import { useTranslations } from "next-intl";

export interface UpcomingItem {
  id: string;
  slug: string;
  title: string;
  cover_image: string | null;
  release_type: string;
  release_date: string;
  artistName: string | null;
}

export default function UpcomingDropsClient({
  items,
  canAdd = true,
}: {
  items: UpcomingItem[];
  /** Show the paste-a-Spotify-link slot. The logged-out splash sets
      this false (adding needs an account) so guests still get the
      countdowns + live-room links, just not the add box
      (Luca 2026-08-26). */
  canAdd?: boolean;
}) {
  const [view, setView] = useReviewView();
  // LANGUAGES: header, View All, "Drops in", the add-box copy
  // (messages → "home.dropping"). Titles/artists/dates are data.
  const t = useTranslations("home.dropping");

  // Guests with nothing upcoming would see a header floating over
  // nothing — the add box is what earns the empty state its keep.
  if (!canAdd && items.length === 0) return null;

  return (
    <section className="space-y-4">
      {/* Header — orb + white title ONLY, same as the Community Feed
          (Luca 2026-08-26: the Countdown chip is gone for good, and
          the phone sizes are compact so View All never gets cut off —
          at the old text-xl/gap-3/full toggle padding the row was
          ~40px wider than a 390px screen). */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="glow-orb shrink-0" style={{ animationDelay: "1.2s" }} />
        <h2 className="font-[family-name:var(--font-heading)] text-lg sm:text-xl font-bold text-text-primary min-w-0 truncate">
          {t("title")}
        </h2>
        <div className="flex-1 divider-glow" />
        {items.length > 0 && <ViewToggle view={view} onChange={setView} />}
        <Link
          href="/releases"
          className="label-xbox shrink-0 hover:text-accent-primary transition-colors"
        >
          {t("viewAll")}
        </Link>
      </div>

      {/* ===== Posters ===== */}
      {items.length > 0 && view === "posters" && (
        <div className="poster-grid">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/releases/${item.slug}`}
              className="release-art group space-y-1.5"
              title={`${item.title}${item.artistName ? ` — ${item.artistName}` : ""}`}
            >
              <span className="poster">
                {item.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={smallCover(item.cover_image)}
                    alt={t("coverAlt", { title: item.title })}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-4xl">
                    💿
                  </span>
                )}
                <span className="absolute bottom-1.5 left-1.5 pixel-text text-[11px] text-osd-amber bg-black/80 border border-osd-amber/50 rounded px-1.5 py-0.5 tracking-widest">
                  <LiveCountdown releaseDate={item.release_date} />
                </span>
              </span>
              <span className="block">
                <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)] group-hover:text-osd-amber transition-colors">
                  {item.title}
                </span>
                <span className="block text-xs text-text-secondary truncate">
                  {item.artistName ?? ""}
                  {item.artistName ? " · " : ""}
                  {formatDropDate(item.release_date)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* ===== Compact rows ===== */}
      {items.length > 0 && view === "compact" && (
        <div className="panel-xbox divide-y divide-border-subtle">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/releases/${item.slug}`}
              className="release-row flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated transition-colors"
            >
              <span className="w-9 h-9 rounded overflow-hidden bg-bg-elevated border border-border-subtle shrink-0">
                {item.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={smallCover(item.cover_image)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-base">
                    💿
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-bold text-text-primary font-[family-name:var(--font-heading)]">
                  {item.title}
                </span>
                {item.artistName && (
                  <span className="text-text-secondary"> — {item.artistName}</span>
                )}
              </span>
              <span className="hidden sm:inline pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
                {formatDropDate(item.release_date)}
              </span>
              <span className="pixel-text text-xs text-osd-amber tracking-widest shrink-0">
                <LiveCountdown releaseDate={item.release_date} />
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* ===== Detailed cards (default) ===== */}
      {items.length > 0 && view === "detailed" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/releases/${item.slug}`}
              className="release-tile panel-xbox p-4 sm:p-5 space-y-3 group cursor-pointer hover-glow relative overflow-hidden border-osd-amber/30"
            >
              <div className="aspect-square rounded-lg bg-[rgba(30,144,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center relative overflow-hidden group-hover:border-osd-amber/50 transition-all">
                {item.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.cover_image}
                    srcSet={`${smallCover(item.cover_image)} 300w, ${item.cover_image} 640w`}
                    sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                    alt={t("coverAlt", { title: item.title })}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <span className="text-5xl text-text-muted group-hover:scale-110 transition-transform">
                    {"//"}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="label-xbox text-[0.6rem]">
                  {item.release_type.toUpperCase()}
                </span>
                <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
                  {formatDropDate(item.release_date)}
                </span>
              </div>

              <div>
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#e8e6e3] group-hover:text-osd-amber transition-colors line-clamp-2">
                  {item.title}
                </h3>
                {item.artistName && (
                  <p className="text-sm text-text-secondary">{item.artistName}</p>
                )}
              </div>

              {/* Where released cards show the community average, a
                  countdown card shows the clock — big and ticking. */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
                  {t("dropsIn")}
                </span>
                <span className="pixel-text text-base font-bold text-osd-amber tracking-widest">
                  <LiveCountdown releaseDate={item.release_date} />
                </span>
              </div>

              <div className="scan-bar" />
            </Link>
          ))}
        </div>
      )}

      {/* The add slot — Spotify album links only, future drops only.
          Signed-in only: the ensure route wants a session. */}
      {canAdd && (
        <div className="panel-xbox p-4 sm:p-5 space-y-3 border-osd-amber/30">
          <p className="text-xs text-text-secondary">{t("addBody")}</p>
          <UpcomingDropBox />
        </div>
      )}
    </section>
  );
}
