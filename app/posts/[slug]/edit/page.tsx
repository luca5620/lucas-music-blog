import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { getPostBySlug, postReleaseArtistName } from "@/lib/db/posts";
import { getReleaseById } from "@/lib/db/releases";
import PostForm from "@/components/posts/PostForm";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Edit Post",
  robots: { index: false, follow: false },
};

/**
 * /posts/[slug]/edit — author-only edit, reusing PostForm in edit
 * mode (PATCH instead of POST; the slug never changes). Anyone else
 * landing here gets bounced to the post itself.
 */
export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireAuth();

  const post = await getPostBySlug(slug);
  if (!post) notFound();
  if (post.user_id !== user.id) redirect(`/posts/${slug}`);

  // PostForm's release chip wants the full catalog row (year, type),
  // not the slim joined slice — fetch it when the post is tied.
  const release = post.release_id
    ? await getReleaseById(post.release_id)
    : null;
  const artistName = postReleaseArtistName(post.release) ?? "";
  const t = await getTranslations("posts.new");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <section className="space-y-2">
        <div className="vhs-label inline-block text-sm">{t("editStamp")}</div>
        <h1 className="crt-title text-3xl sm:text-4xl">{t("editTitle")}</h1>
        <p className="text-sm text-text-secondary">{t("editSub")}</p>
      </section>

      <PostForm
        post={post}
        initialRelease={release}
        initialArtist={artistName}
      />
    </div>
  );
}
