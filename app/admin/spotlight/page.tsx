/**
 * /admin/spotlight — picking the Community Spotlight (migration 068).
 *
 * Paste an album's link, pick the Monday its week starts, add one line
 * on why (optional, shows on the home page in quotes) and save. Weeks
 * run Monday → Sunday, New York time. Picking a week again replaces
 * its album. Owners + admins (the middleware also demands an
 * email-code session on every /admin path).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import SpotlightAdmin, { type AdminWeek } from "./SpotlightAdmin";

export const metadata = { title: "Spotlight Tool" };
export const dynamic = "force-dynamic";

export default async function AdminSpotlightPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as Pick<Profile, "role"> | null)?.role;
  if (role !== "owner" && role !== "admin") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="panel-xbox-glow p-8">
          <span className="label-xbox mb-4 inline-flex">Access Denied</span>
          <h1 className="pixel-text text-2xl font-bold mb-3">Staff only.</h1>
        </div>
      </main>
    );
  }

  // Upcoming + the last few weeks, newest first. Fails soft to an
  // empty list (e.g. before migration 068 has been run).
  const { data } = await supabase
    .from("spotlight_weeks")
    .select("id, week_start, starts_at, ends_at, note, releases!inner(title, slug)")
    .order("week_start", { ascending: false })
    .limit(12);
  type Row = {
    id: string;
    week_start: string;
    starts_at: string;
    ends_at: string;
    note: string | null;
    releases: { title: string; slug: string } | { title: string; slug: string }[];
  };
  const weeks: AdminWeek[] = ((data ?? []) as unknown as Row[]).map((w) => {
    const rel = Array.isArray(w.releases) ? w.releases[0] : w.releases;
    return {
      id: w.id,
      weekStart: w.week_start,
      startsAt: w.starts_at,
      endsAt: w.ends_at,
      note: w.note,
      title: rel?.title ?? "?",
      slug: rel?.slug ?? "",
    };
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 space-y-6">
      <div className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">SPOTLIGHT TOOL</h1>
        <p className="text-text-secondary text-sm">
          One album a week for everyone. It shows on the home page and on the
          album page from Monday 00:00 to Sunday 23:59 (New York), and app users
          who haven&apos;t rated it get a push Monday at 10am.
        </p>
      </div>
      <SpotlightAdmin initialWeeks={weeks} />
    </main>
  );
}
