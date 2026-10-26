import { notFound, permanentRedirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Merged-page redirects (migration 066, Luca 2026-10-26: "merge the
 * duplicate albums"). When two catalog rows turned out to be the same
 * record or artist, the copy was deleted and its old address saved in
 * public.slug_redirects — so a shared link or a Google result that
 * points at the copy still lands on the kept page.
 *
 * Call this where a page would 404: it permanently redirects (308)
 * when the slug was merged away, and 404s otherwise. Before 066 is run
 * the table doesn't exist, the query errors, and it's a plain 404.
 */
export async function redirectMergedOr404(
  kind: "release" | "artist",
  slug: string
): Promise<never> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("slug_redirects")
    .select("new_slug")
    .eq("kind", kind)
    .eq("old_slug", slug)
    .maybeSingle();
  const to = (data as { new_slug?: string } | null)?.new_slug;
  if (to && to !== slug) {
    permanentRedirect(`/${kind === "release" ? "releases" : "artists"}/${to}`);
  }
  notFound();
}
