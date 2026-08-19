/**
 * ReleasesFeed — server half of the home page Latest Drops section.
 * Fetches the release discovery feed and hands normalized items to
 * ReleasesFeedClient (which renders the view-switchable UI).
 */

import { getReleaseDiscoveryFeed } from "@/lib/db/releases";
import ReleasesFeedClient from "@/components/feed/ReleasesFeedClient";
import type { ReleaseListItem } from "@/components/releases/ReleaseViews";

export default async function ReleasesFeed() {
  let feed: Awaited<ReturnType<typeof getReleaseDiscoveryFeed>> = [];
  try {
    feed = await getReleaseDiscoveryFeed(9);
  } catch {
    // Table may not exist yet (pre-migration). Degrade silently.
    feed = [];
  }

  if (feed.length === 0) return null;

  const items: ReleaseListItem[] = feed.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    cover_image: item.cover_image,
    release_type: item.release_type,
    release_date: item.release_date,
    artistName: item.primary_artist.name,
    avgRating: item.avg_rating,
    reviewCount: item.review_count,
    followerCount: item.follower_count,
    lastActivityAt: item.last_activity_at,
  }));

  return <ReleasesFeedClient items={items} />;
}
