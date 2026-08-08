import Link from "next/link";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { getPublicLists } from "@/lib/db/lists";
import ListCard from "@/components/lists/ListCard";

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
  const [lists, user] = await Promise.all([
    getPublicLists({ limit: 24 }),
    getUser(),
  ]);

  return (
    <div className="space-y-6">
      {/* --- Header --- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold text-[#e8e6e3]">
            Lists
          </h1>
          <p className="font-[family-name:var(--font-vt323)] text-lg text-[#9a9a9e]">
            albums, curated — rankings, moods, obsessions
          </p>
        </div>

        {/* Only signed-in users can start a list. */}
        {user && (
          <Link href="/lists/new" className="btn-y2k btn-y2k-primary">
            + New List
          </Link>
        )}
      </div>

      <div className="divider-glow" />

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
