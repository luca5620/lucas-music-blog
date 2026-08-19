import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import PostForm from "@/components/posts/PostForm";

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <section className="space-y-2">
        <div className="vhs-label inline-block text-sm">NEW TRANSMISSION</div>
        <h1 className="crt-title text-3xl sm:text-4xl">Write a post</h1>
        <p className="text-sm text-text-secondary">
          Longer than a review, looser than one too. Drop a YouTube or
          TikTok video if you have one, and tie it to the release it&apos;s
          about so readers can jump straight to the record.
        </p>
      </section>

      <PostForm />
    </div>
  );
}
