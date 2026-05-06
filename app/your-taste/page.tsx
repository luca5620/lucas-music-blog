import ComingSoonPanel from "@/components/ui/ComingSoonPanel";

export const metadata = {
  title: "Your Taste",
  robots: { index: false, follow: false },
};

export default function YourTastePage() {
  return (
    <ComingSoonPanel
      title="YOUR TASTE"
      tagline="a feed tuned to your ears"
      description="Recommendations pulled from your listening history, reviews from people who actually overlap with what you play, and predictions on releases you'll love. Engine boots up in Phase 2 — for now, this is the room where it'll live."
      accent="rose"
      eta="PHASE 2"
    />
  );
}
