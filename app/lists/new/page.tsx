import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import ListEditor from "@/components/lists/ListEditor";
import PlaylistImportBox from "@/components/playlists/PlaylistImportBox";

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
  // The playlist slot rides on top (Luca 2026-09-02): paste a Spotify
  // playlist and the list is built from it, landing on its edit page.
  // Below it, the regular one-record-at-a-time editor.
  return (
    <div className="space-y-6">
      <PlaylistImportBox />
      <ListEditor mode="create" username={profile.username} />
    </div>
  );
}
