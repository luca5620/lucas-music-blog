/**
 * DiscoveryFeed — server half of the home page Community Feed.
 * Fetches the latest published reviews (with the viewer's like
 * state) and hands them to DiscoveryFeedClient, which renders the
 * view-switchable UI (detailed / posters / compact).
 */

import { getDiscoveryFeed } from "@/lib/db/reviews";
import { createClient } from "@/lib/supabase/server";
import { getViewerBlockedIdSet } from "@/lib/db/moderation";
import DiscoveryFeedClient, {
  type FeedReview,
} from "@/components/reviews/DiscoveryFeedClient";

export default async function DiscoveryFeed() {
  let viewerId: string | undefined;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    viewerId = user?.id;
  } catch {
    // Supabase may not be configured
  }

  const [rawFeed, blocked] = await Promise.all([
    getDiscoveryFeed(9, viewerId) as unknown as Promise<FeedReview[]>,
    getViewerBlockedIdSet(),
  ]);

  // Blocked authors never reach the viewer's feed (App Store 1.2 —
  // BlockButton calls router.refresh() so this re-runs instantly).
  const feed = rawFeed.filter((r) => !blocked.has(r.user_id));

  if (feed.length === 0) return null;

  return <DiscoveryFeedClient feed={feed} />;
}
