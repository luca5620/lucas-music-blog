/**
 * /admin/badges — Luca's badge-granting dev tool.
 *
 * OWNER-only (stricter than the other staff pages: badges are the
 * founder's to hand out). Type a username, pick a badge, grant.
 * The gold Founder badge is not on the menu — it stays exclusive.
 * The actual write happens through the grant_badge security-definer
 * RPC (migration 019); this page is just the friendly face.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import BadgeGrantForm from "./BadgeGrantForm";

export const metadata = { title: "Badge Tool" };

export default async function AdminBadgesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as Pick<Profile, "role"> | null)?.role;

  if (role !== "owner") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="panel-xbox-glow p-8">
          <span className="label-xbox mb-4 inline-flex">Access Denied</span>
          <h1 className="pixel-text text-2xl font-bold mb-3">
            This area is founder-only.
          </h1>
          <p className="text-sm opacity-70">
            Badges are handed out by the founder personally.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 space-y-6">
      <div className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">BADGE TOOL</h1>
        <p className="text-text-secondary text-sm">
          Grant any verification badge by username. The gold Founder
          badge isn&apos;t grantable — that one&apos;s yours alone.
        </p>
      </div>

      <BadgeGrantForm />
    </main>
  );
}
