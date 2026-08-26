"use client";

/**
 * AddToCatalog — "put it on PMR" box.
 *
 * A CatalogSearch that, instead of attaching the pick to a form
 * (review, list, …), just imports the release and navigates straight
 * to its brand-new page — where the live room is already open.
 *
 * This is the front door for UPCOMING albums: Spotify search hides
 * pre-release albums, but pasting the album's Spotify link resolves
 * it directly (full tracklist + future release date), so anyone can
 * open the album's page — and its chatroom — weeks before it drops.
 */

import { useRouter } from "next/navigation";
import CatalogSearch, { type CatalogPick } from "./CatalogSearch";

export default function AddToCatalog() {
  const router = useRouter();

  function handlePick(pick: CatalogPick) {
    router.push(`/releases/${pick.release.slug}`);
  }

  return (
    <div className="panel-xbox p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="glow-orb" />
        <span className="label-xbox">Add to the station</span>
      </div>
      <p className="text-xs text-text-secondary">
        Not on PMR yet? Search it or paste a Spotify link and its page opens
        instantly. Works for albums that haven&apos;t dropped — paste the
        upcoming album&apos;s Spotify link and the live room is waiting before
        release day.
      </p>
      <CatalogSearch onPick={handlePick} label="" />
    </div>
  );
}
