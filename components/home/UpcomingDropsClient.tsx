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
 * stamps — nothing here can have reviews yet.
 */

import Link from "next/link";
import { smallCover } from "@/lib/images";
import { formatDropDate } from "@/lib/upcoming";
import LiveCountdown from "@/components/releases/LiveCountdown";
import UpcomingDropBox from "@/components/home/UpcomingDropBox";
import { useReviewView, ViewToggle } from "@/components/reviews/ViewToggle";

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
}: {
  items: UpcomingItem[];
}) {
  const [view, setView] = useReviewView();

  return (
    <section className="space-y-4">
      {/* Header — same skeleton as Latest Drops */}
      <div className="flex items-center gap-3">
        <span className="glow-orb" style={{ animationDelay: "1.2s" }} />
        <span className="label-xbox">Countdown</span>
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary">
          Dropping Soon
        </h2>
        <div className="flex-1 divider-glow" />
        {items.length > 0 && <ViewToggle view={view} onChange={setView} />}
        <Link
          href="/releases"
          className="label-xbox hover:text-accent-primary transition-colors"
        >
          View All →
        </Link>
      </div>

      {/* ===== Posters ===== */}
      {items.length > 0 && view === "posters" && (
        <div className="poster-grid">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/releases/${item.slug}`}
              className="group space-y-1.5"
              title={`${item.title}${item.artistName ? ` — ${item.artistName}` : ""}`}
            >
              <span className="poster">
                {item.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={smallCover(item.cover_image)}
                    alt={`${item.title} cover`}
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
              className="flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated transition-colors"
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
              className="panel-xbox p-4 sm:p-5 space-y-3 group cursor-pointer hover-glow relative overflow-hidden border-osd-amber/30"
            >
              <div className="aspect-square rounded-lg bg-[rgba(30,144,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center relative overflow-hidden group-hover:border-osd-amber/50 transition-all">
                {item.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.cover_image}
                    srcSet={`${smallCover(item.cover_image)} 300w, ${item.cover_image} 640w`}
                    sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                    alt={`${item.title} cover`}
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
                  Drops in
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

      {/* The add slot — Spotify album links only, future drops only */}
      <div className="panel-xbox p-4 sm:p-5 space-y-3 border-osd-amber/30">
        <p className="text-xs text-text-secondary">
          Know an album that&apos;s coming? Paste its Spotify link and the
          countdown page + live room open before the album does.
        </p>
        <UpcomingDropBox />
      </div>
    </section>
  );
}
