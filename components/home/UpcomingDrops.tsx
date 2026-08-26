/**
 * UpcomingDrops — server half of the home DROPPING SOON module.
 *
 * Fetches every catalog release whose drop moment (midnight Eastern,
 * lib/upcoming) is still ahead and hands normalized items to
 * UpcomingDropsClient, which renders the header (matching the other
 * home modules), the view-switchable countdown listing, and the
 * paste-a-Spotify-link slot. Always renders — the paste box is how
 * the first upcoming album gets here.
 */

import { listUpcomingReleases } from "@/lib/db/releases";
import UpcomingDropsClient, {
  type UpcomingItem,
} from "@/components/home/UpcomingDropsClient";

export default async function UpcomingDrops({
  canAdd = true,
}: {
  /** Passed through to the client half — the logged-out splash
      hides the paste box (adding needs an account). */
  canAdd?: boolean;
} = {}) {
  let upcoming: Awaited<ReturnType<typeof listUpcomingReleases>> = [];
  try {
    upcoming = await listUpcomingReleases(8);
  } catch {
    upcoming = [];
  }

  const items: UpcomingItem[] = upcoming
    .filter((r) => r.release_date)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      cover_image: r.cover_image,
      release_type: r.release_type,
      release_date: r.release_date!,
      artistName: r.artists?.name ?? null,
    }));

  return <UpcomingDropsClient items={items} canAdd={canAdd} />;
}
