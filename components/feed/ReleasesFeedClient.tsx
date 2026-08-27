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
      {/* Header — orb + white title only (New Releases chip removed
          for good, Luca 2026-08-26), compact phone sizes so View All
          never clips. Same skeleton as every other home module. */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="glow-orb shrink-0" style={{ animationDelay: "2.5s" }} />
        <h2 className="font-[family-name:var(--font-heading)] text-lg sm:text-xl font-bold text-text-primary min-w-0 truncate">
          Latest Drops
        </h2>
        <div className="flex-1 divider-glow" />
        <ViewToggle view={view} onChange={setView} />
        <Link
          href="/releases"
          className="label-xbox shrink-0 hover:text-accent-primary transition-colors"
        >
          View All →
        </Link>
      </div>

      <ReleaseViews items={items} view={view} />
    </section>
  );
}
