/**
 * DiscoveryFeed — server half of the home page Community Feed.
 * Fetches the latest published reviews (with the viewer's like
 * state) and hands them to DiscoveryFeedClient, which renders the
 * view-switchable UI (detailed / posters / compact).
 */

import { getDiscoveryFeed } from "@/lib/db/reviews";
import { createClient } from "@/lib/supabase/server";
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

  const feed = (await getDiscoveryFeed(9, viewerId)) as unknown as FeedReview[];

  if (feed.length === 0) return null;

  return <DiscoveryFeedClient feed={feed} />;
}
