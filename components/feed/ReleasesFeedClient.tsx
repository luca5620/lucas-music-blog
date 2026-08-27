"use client";

/**
 * ReleasesFeedClient — Latest Drops on the home page, with the view
 * switcher in the header next to "View All" (same shared preference
 * as every other listing).
 */

import Link from "next/link";
import ReleaseViews, {
  type ReleaseListItem,
} from "@/components/releases/ReleaseViews";
import { useReviewView, ViewToggle } from "@/components/reviews/ViewToggle";

export default function ReleasesFeedClient({
  items,
}: {
  items: ReleaseListItem[];
}) {
  const [view, setView] = useReviewView();

  return (
    <section className="space-y-4">
      {/* The New Releases tag is desktop-only — on phones the extra
          chip made the header row wider than the screen (same fix as
          Dropping Soon: match the Community Feed's slim header). */}
      <div className="flex items-center gap-3">
        <span className="glow-orb" style={{ animationDelay: "2.5s" }} />
        <span className="label-xbox hidden sm:inline">New Releases</span>
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary">
          Latest Drops
        </h2>
        <div className="flex-1 divider-glow" />
        <ViewToggle view={view} onChange={setView} />
        <Link
          href="/releases"
          className="label-xbox hover:text-accent-primary transition-colors"
        >
          View All →
        </Link>
      </div>

      <ReleaseViews items={items} view={view} />
    </section>
  );
}
