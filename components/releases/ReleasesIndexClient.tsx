"use client";

/**
 * ReleasesIndexClient — the /releases grid with the view switcher
 * (toggle right-aligned above the listing; same shared preference
 * as all the other listings).
 */

import ReleaseViews, {
  type ReleaseListItem,
} from "@/components/releases/ReleaseViews";
import { useReviewView, ViewToggle } from "@/components/reviews/ViewToggle";

export default function ReleasesIndexClient({
  items,
}: {
  items: ReleaseListItem[];
}) {
  const [view, setView] = useReviewView();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ViewToggle view={view} onChange={setView} />
      </div>
      <ReleaseViews items={items} view={view} />
    </div>
  );
}
