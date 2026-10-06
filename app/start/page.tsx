/**
 * /start — the first-rating screen (2026-10-05).
 *
 * Where every brand-new account lands, once: "rate 3 records you
 * know". The routing that sends people here lives in lib/onboarding.ts
 * (email confirm → /auth/confirm?next=/start; Google/Apple → the
 * callback / in-app finish; password sign-in → /login), and the home
 * page's "Rate your first record" button points here while the
 * member's shelf is empty.
 *
 * FIRST-RUN ONLY. It is not a second way to review (Quick Rate was
 * rejected for that): anyone who already has 3+ published reviews is
 * sent straight on to ?next=, and the finished screen hands over to
 * the real review form rather than serving more cards.
 *
 * Server half: auth + the gates + the grid data. The interactive half
 * is components/onboarding/FirstRatings.tsx.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStarterPicks } from "@/lib/db/onboarding";
import { FIRST_RATINGS_GOAL, safeNextPath, startPath } from "@/lib/onboarding";
import FirstRatings from "@/components/onboarding/FirstRatings";

export const metadata: Metadata = {
  title: "Rate your first records",
  // A personal, signed-in screen — nothing for a search engine here.
  robots: { index: false, follow: false },
};

// Per-viewer (their own reviews are filtered out) — always fresh.
export const dynamic = "force-dynamic";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  // Where Skip / Go home lead. Same-site paths only.
  const next = safeNextPath(rawNext);

  const user = await getUser();
  if (!user) {
    // Signed out: most often an email confirmation link that opened in
    // a different browser (/auth/confirm lands here with ?error=link).
    // /login explains that calmly and brings them back here after.
    const params = new URLSearchParams({ next: startPath(next) });
    if (error === "link") params.set("error", "link");
    redirect(`/login?${params.toString()}`);
  }

  const supabase = await createClient();
  const [{ data: profileRow }, { data: reviewRows }] = await Promise.all([
    // "*" rather than naming username_auto, so a database without
    // migration 031 still returns the row instead of an error.
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    // Every review they have, drafts included: drafts would 409 on the
    // grid, published ones count toward the three.
    supabase.from("reviews").select("release_id, is_published").eq("user_id", user.id),
  ]);
  const profile = profileRow as { username?: string; username_auto?: boolean } | null;
  const mine = (reviewRows ?? []) as { release_id: string | null; is_published: boolean }[];

  // A social sign-in that skipped the handle screen (e.g. the old
  // "/?code=" link was rerouted here) — claim the handle first; it's
  // in every review URL they're about to create.
  if (profile?.username_auto) {
    redirect(`/welcome?next=${encodeURIComponent(startPath(next))}`);
  }

  // Not a first run any more — never trap an existing member here.
  const published = mine.filter((r) => r.is_published).length;
  if (published >= FIRST_RATINGS_GOAL) redirect(next);

  const alreadyReviewed = new Set(
    mine.map((r) => r.release_id).filter((id): id is string => !!id)
  );
  const picks = await getStarterPicks(alreadyReviewed);

  return (
    <FirstRatings
      picks={picks}
      next={next}
      username={profile?.username ?? null}
      startCount={published}
    />
  );
}
