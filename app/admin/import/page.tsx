import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import AdminImportForm from "./AdminImportForm";

export const metadata: Metadata = {
  title: "Spotify Import — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminImportPage() {
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

  if (role !== "owner" && role !== "admin") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="panel-xbox-glow p-8">
          <span className="label-xbox mb-4 inline-flex">Access Denied</span>
          <h1 className="pixel-text text-2xl font-bold mb-3">
            This area is owner-only.
          </h1>
          <p className="text-sm opacity-70">
            The Spotify import tool is reserved for site staff. If you think
            you&apos;re seeing this in error, ping the owner.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <span className="label-xbox mb-3 inline-flex">Admin // Phase 2a</span>
        <h1 className="pixel-text text-3xl font-bold mb-2">Spotify Import</h1>
        <p className="text-sm opacity-70">
          Paste a Spotify artist or album URL. The importer will pull metadata,
          cover art, tracklist, and feature credits, then upsert the entity row
          so it can be linked from reviews and pages.
        </p>
      </div>
      <AdminImportForm />
    </main>
  );
}
