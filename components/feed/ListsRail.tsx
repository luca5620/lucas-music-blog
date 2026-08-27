/**
 * ListsRail — "Fresh Lists" section for the home page.
 * Server component: fetches recent public lists and renders them as cards.
 * Renders nothing if there are no lists yet (so the home page stays clean
 * until the community starts making them).
 */
import Link from "next/link";
import { getPublicLists } from "@/lib/db/lists";
import ListCard from "@/components/lists/ListCard";

export default async function ListsRail() {
  const lists = await getPublicLists({ limit: 4, offset: 0 });
  if (!lists || lists.length === 0) return null;

  return (
    <section className="space-y-4">
      {/* Header matches the Community Feed module (Luca 2026-08-26:
          every home module wears the same header). */}
      <div className="flex items-center gap-3">
        <span className="glow-orb" style={{ animationDelay: "1.2s" }} />
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary">
          Fresh Lists
        </h2>
        <div className="flex-1 divider-glow" />
        <Link
          href="/lists"
          className="label-xbox hover:text-accent-primary transition-colors"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {lists.map((list) => (
          <ListCard key={list.id} list={list} />
        ))}
      </div>
    </section>
  );
}
