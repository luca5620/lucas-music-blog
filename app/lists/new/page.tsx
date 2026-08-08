import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import ListEditor from "@/components/lists/ListEditor";

export const metadata: Metadata = {
  title: "New List",
};

/**
 * /lists/new — create a new list. Requires login; the editor
 * redirects to the list's public page after a successful save.
 */
export default async function NewListPage() {
  // getProfile() returns null when signed out OR when the profile row
  // is missing — either way there's nobody to own the list.
  const profile = await getProfile();
  if (!profile) {
    redirect("/login");
  }

  // The editor needs the username to build the redirect URL
  // (/lists/[username]/[slug]) after the list is created.
  return <ListEditor mode="create" username={profile.username} />;
}
