import Link from "next/link";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { getPublicLists } from "@/lib/db/lists";
import { getViewerBlockedIdSet } from "@/lib/db/moderation";
import ListCard from "@/components/lists/ListCard";
import PageHero from "@/components/ui/PageHero";
import BackToHome from "@/components/ui/BackToHome";

export const metadata: Metadata = {
  title: "Lists",
  description:
    "Browse album lists curated by the community — rankings, moods, deep dives, and more.",
};

// Lists change often (likes, new lists) — always render fresh.
export const dynamic = "force-dynamic";

/**
 * /lists — browse recent public lists.
 * Server component: fetches the lists (plus the viewer, to decide
 * whether to show the "New list" button) and renders a card grid.
 */
export default async function ListsPage() {
  const [allLists, user, blocked] = await Promise.all([
    getPublicLists({ limit: 24 }),
    getUser(),
    getViewerBlockedIdSet(),
  ]);
  // Blocked authors never reach the viewer's wall (App Store 1.2).
  const lists = allLists.filter((l) => !blocked.has(l.user_id));

  return (
    <div className="space-y-6">
      {/* App-only way back to the home page (this page has no tab) */}
      <BackToHome />

      {/* --- Header — boxed hero, same as HOME --- */}
      <PageHero title="LISTS" sub="Albums, curated — rankings, moods, obsessions.">
        {/* Only signed-in users can start a list. */}
        {user && (
          <div className="pt-1">
            <Link href="/lists/new" className="btn-y2k btn-y2k-primary">
              + New List
            </Link>
          </div>
        )}
      </PageHero>

      {/* --- Grid of list cards --- */}
      {lists.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      ) : (
        <div className="panel-xbox p-8 text-center space-y-3">
          <p className="text-text-secondary">No lists yet.</p>
          <p className="font-[family-name:var(--font-vt323)] text-[#9a9a9e]">
            be the first to rank something
          </p>
          {user ? (
            <Link href="/lists/new" className="btn-y2k btn-y2k-outline">
              Start a List
            </Link>
          ) : (
            <Link href="/login" className="btn-y2k btn-y2k-outline">
              Sign in to start one
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
