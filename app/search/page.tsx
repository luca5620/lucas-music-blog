/**
 * /search — universal search across the whole station: users,
 * artists, releases, reviews, debates, lists, posts. The app's
 * middle tab; the web header's magnifier. All querying happens
 * client-side in UniversalSearch (world-readable tables + RLS).
 */

import type { Metadata } from "next";
import UniversalSearch from "@/components/search/UniversalSearch";
import PageHero from "@/components/ui/PageHero";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};

export default function SearchPage() {
  const t = useTranslations("search");
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <PageHero
        title={t("title")}
        sub={t("sub")}
      />
      <UniversalSearch />
    </div>
  );
}
