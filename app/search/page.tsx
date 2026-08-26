/**
 * /search — universal search across the whole station: users,
 * artists, releases, reviews, debates, lists, posts. The app's
 * middle tab; the web header's magnifier. All querying happens
 * client-side in UniversalSearch (world-readable tables + RLS).
 */

import type { Metadata } from "next";
import UniversalSearch from "@/components/search/UniversalSearch";
import AddToCatalog from "@/components/catalog/AddToCatalog";
import PageHero from "@/components/ui/PageHero";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};

export default async function SearchPage() {
  // The add-box hits auth-gated catalog APIs, so it only renders for
  // logged-in users — logged-out visitors just get universal search.
  const user = await getUser();

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <PageHero
        title="SEARCH"
        sub="Every channel at once — people, artists, releases, reviews, debates, lists, posts."
      />
      <UniversalSearch />

      {/* Import anything from Spotify/Genius — including UPCOMING
          albums via a pasted Spotify link (the countdown feature's
          front door). Picking a result opens the release page, which
          opens its live room. */}
      {user && <AddToCatalog />}
    </div>
  );
}
