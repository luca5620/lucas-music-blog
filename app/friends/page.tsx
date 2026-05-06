/**
 * /friends — Phase 2 placeholder for the social layer.
 */

import ComingSoonPanel from "@/components/ui/ComingSoonPanel";

export const metadata = {
  title: "Friends",
  robots: { index: false, follow: false },
};

export default function FriendsPage() {
  return (
    <ComingSoonPanel
      title="FRIENDS"
      tagline="the room you're not in yet"
      description="A real-time feed of what people you follow are listening to, reviewing, and reacting to. Live release rooms, group reactions, the whole social layer. Nothing here yet — we're building the rails first. Come back when the lights turn on."
      accent="primary"
      eta="PHASE 2"
    />
  );
}
