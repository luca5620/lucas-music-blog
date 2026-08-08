import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { getListBySlug } from "@/lib/db/lists";
import ListEditor from "@/components/lists/ListEditor";

export const metadata: Metadata = {
  title: "Edit List",
};

interface PageParams {
  params: Promise<{ username: string; slug: string }>;
}

/**
 * /lists/[username]/[slug]/edit — owner-only edit page.
 * Anyone else gets redirected: signed-out users to /login,
 * signed-in non-owners back to the public list page.
 */
export default async function EditListPage({ params }: PageParams) {
  const { username, slug } = await params;

  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const list = await getListBySlug(username, slug);
  if (!list) notFound();

  // Only the owner may edit — everyone else sees the read-only page.
  if (list.user_id !== user.id) {
    redirect(`/lists/${username}/${slug}`);
  }

  return (
    <ListEditor
      mode="edit"
      username={list.author.username}
      list={list}
      initialItems={list.items}
    />
  );
}
