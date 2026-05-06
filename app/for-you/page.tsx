/**
 * /for-you — Phase 2 placeholder for the recommendation engine.
 */

import ComingSoonPanel from "@/components/ui/ComingSoonPanel";

export const metadata = {
  title: "For You",
  robots: { index: false, follow: false },
};

export default function ForYouPage() {
  return (
    <ComingSoonPanel
      title="FOR YOU"
      tagline="a feed tuned to your ears"
      description="Your taste, profiled. Recommendations from your listening history, reviews from people who actually overlap with what you play, and predictions on releases you'll love. Recommendation engine boots up in Phase 2 — for now, this is the room where it'll live."
      accent="rose"
      eta="PHASE 2"
    />
  );
}
