/**
 * ListsRail — "Fresh Lists" section for the home page.
 * Server component: fetches recent public lists and renders them as cards.
 * Renders nothing if there are no lists yet (so the home page stays clean
 * until the community starts making them).
 */
import Link from "next/link";
import { getPublicLists } from "@/lib/db/lists";
import ListCard from "@/components/lists/ListCard";
import { getTranslations } from "next-intl/server";

export default async function ListsRail() {
  const lists = await getPublicLists({ limit: 4, offset: 0 });
  if (!lists || lists.length === 0) return null;
  const t = await getTranslations("releases.feed");
  const tc = await getTranslations("common");

  return (
    <section className="space-y-4">
      {/* Header matches the Community Feed module (Luca 2026-08-26:
          every home module wears the same header). */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="glow-orb shrink-0" style={{ animationDelay: "1.2s" }} />
        <h2 className="font-[family-name:var(--font-heading)] text-lg sm:text-xl font-bold text-text-primary min-w-0 truncate">
          {t("freshLists")}
        </h2>
        <div className="flex-1 divider-glow" />
        <Link
          href="/lists"
          className="label-xbox shrink-0 hover:text-accent-primary transition-colors"
        >
          {tc("viewAll")}
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
