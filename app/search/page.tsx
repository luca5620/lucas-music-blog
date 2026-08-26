/**
 * /search — universal search across the whole station: users,
 * artists, releases, reviews, debates, lists, posts. The app's
 * middle tab; the web header's magnifier. All querying happens
 * client-side in UniversalSearch (world-readable tables + RLS).
 */

import type { Metadata } from "next";
import UniversalSearch from "@/components/search/UniversalSearch";
import PageHero from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};

export default function SearchPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <PageHero
        title="SEARCH"
        sub="Every channel at once — people, artists, releases, reviews, debates, lists, posts."
      />
      <UniversalSearch />
    </div>
  );
}
