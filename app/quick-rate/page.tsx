/**
 * /quick-rate — the backfill deck (Luca 2026-09-08: "build quick rate
 * next").
 *
 * The one-and-done problem starts with an empty profile: one review,
 * then nothing to come back to. This page is a deck of records the
 * member hasn't rated yet — cover, slider, RATE / HAVEN'T HEARD IT —
 * twenty in two minutes, each tap a real published review (wordless,
 * "the number speaks for itself"). It fills the profile on day one,
 * feeds the taste profile Your Taste runs on, and is what makes the
 * reviewer-outreach ask ("try it") land on a page that isn't empty.
 *
 * Deck = the catalog's most-reviewed / most-popular records, minus
 * unreleased, minus upcoming, minus anything the member already
 * reviewed. A search box on the deck lets them pull any specific
 * record (or paste a Spotify link) to the front.
 *
 * Server component; auth required.
 */

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listReleases } from "@/lib/db/releases";
import { isUpcoming } from "@/lib/upcoming";
import PageHero from "@/components/ui/PageHero";
import QuickRate, { type QuickRateItem } from "@/components/reviews/QuickRate";

// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Quick Rate",
  robots: { index: false, follow: false },
};

// Per-viewer page — always render fresh.
export const dynamic = "force-dynamic";

export default async function QuickRatePage() {
  const user = await requireAuth();
  const t = await getTranslations("quickRate");
  const supabase = await createClient();

  const [{ data: mine }, rows, { data: me }] = await Promise.all([
    supabase.from("reviews").select("release_id").eq("user_id", user.id),
    listReleases({ sort: "popularity", limit: 80 }),
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
  ]);

  const reviewed = new Set(
    ((mine ?? []) as { release_id: string | null }[]).map((r) => r.release_id)
  );
  const deck: QuickRateItem[] = rows
    .filter(
      (r) => !r.is_unreleased && !isUpcoming(r.release_date) && !reviewed.has(r.id)
    )
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      artist: r.artistName ?? "",
      cover_image: r.cover_image,
      release_type: r.release_type,
      year: r.release_date ? r.release_date.slice(0, 4) : null,
    }));

  const username = (me as { username?: string } | null)?.username;
  const profileHref = username ? `/profile/${username}` : "/reviews/mine";

  return (
    <div className="space-y-6 pb-12 max-w-3xl mx-auto">
      <PageHero title={t("title")} sub={t("sub")} />
      <QuickRate initial={deck} profileHref={profileHref} />
    </div>
  );
}
