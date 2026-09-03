import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import PostForm from "@/components/posts/PostForm";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Write a Post",
};

/**
 * /posts/new — write a post.
 * Middleware already gates this route; requireAuth is the
 * second layer (defense in depth, same as the other + pages).
 */
export default async function NewPostPage() {
  await requireAuth();
  const t = await getTranslations("posts.new");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <section className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="text-sm text-text-secondary">{t("sub")}</p>
      </section>

      <PostForm />
    </div>
  );
}
