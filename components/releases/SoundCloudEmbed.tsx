/**
 * SoundCloudEmbed — SoundCloud's widget player, the third preview
 * option on release pages (Luca 2026-09-13: "spotify, apple music, and
 * soundcloud now"). Shown INSTEAD of the other two for members who
 * picked SoundCloud in Settings, when SoundCloud carries the record.
 *
 * Same legal footing as the Spotify and Apple ones: the player is
 * SoundCloud's own widget (w.soundcloud.com) streaming under their
 * terms — we host nothing. Full tracks for everyone, the way
 * SoundCloud works.
 *
 * src is built by lib/soundcloud.ts from the cached, shape-checked
 * permalink (migration 042) — never from anything a user typed.
 * next.config.ts CSP frame-src allows w.soundcloud.com.
 */

import type { Release } from "@/lib/types/database";
import SoundCloudFrame from "@/components/releases/SoundCloudFrame";
import { getTranslations } from "next-intl/server";

export default async function SoundCloudEmbed({
  release,
  permalink,
  bare = false,
}: {
  release: Release;
  /** The soundcloud.com track or set link from the release row. */
  permalink: string;
  /** Inside PlayerTabs: the tab strip is the card header, so render
      the iframe alone (no card, no PREVIEW label). */
  bare?: boolean;
}) {
  // A set (album) link gets the tall player with its tracklist; a
  // single track gets the compact strip.
  const isSet = /\/sets\//.test(permalink);
  const height = isSet ? 450 : 166;
  const t = await getTranslations("releases.embed");

  // The frame + its volume slider (a client island — the Widget API
  // needs a ref to the iframe, which a server component can't hold).
  const iframe = (
    <SoundCloudFrame
      permalink={permalink}
      height={height}
      title={t("soundcloudTitle", { title: release.title })}
      className="xl:flex-1 xl:min-h-0"
    />
  );
  if (bare) return iframe;

  return (
    <div className="card-y2k p-4 sm:p-5 space-y-3 overflow-hidden xl:flex-1 xl:flex xl:flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">{t("preview")}</span>
        </div>
        <a
          href={permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="pixel-text text-[10px] text-text-muted hover:text-accent-primary uppercase tracking-widest transition-colors"
        >
          {t("soundcloudClips")}
        </a>
      </div>
      {iframe}
    </div>
  );
}
