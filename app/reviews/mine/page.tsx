import { requireAuth } from "@/lib/auth";
import { getReviewsByUser } from "@/lib/db/reviews";
import { getUserPosts } from "@/lib/db/posts";
import { getRatingHex } from "@/lib/rating";
import Link from "next/link";
import type { Metadata } from "next";
import DeleteReviewButton from "@/components/reviews/DeleteReviewButton";
import DeletePostButton from "@/components/posts/DeletePostButton";

export const metadata: Metadata = {
  title: "My Reviews & Posts",
};

export default async function MyReviewsPage() {
  const user = await requireAuth();
  const [reviews, posts] = await Promise.all([
    getReviewsByUser(user.id, { includeUnpublished: true }),
    getUserPosts(user.id, { includeUnpublished: true }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold text-[#e8e6e3]">
            My Reviews
          </h1>
          <p className="font-[family-name:var(--font-vt323)] text-lg text-[#9a9a9e]">
            {reviews.length} review{reviews.length !== 1 ? "s" : ""} total
          </p>
        </div>

        <Link href="/reviews/new" className="btn-y2k btn-y2k-primary shrink-0">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Write Review
        </Link>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="panel-xbox p-8 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-xl text-[#5a5a60]">
            No reviews yet. Write your first one!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const ratingColor = getRatingHex(review.rating);

            return (
              <div
                key={review.id}
                className="panel-xbox p-4 hover-glow"
              >
                <div className="flex items-start gap-4">
                  {/* Cover Image */}
                  {review.cover_image ? (
                    <img
                      src={review.cover_image}
                      alt={review.title}
                      className="w-16 h-16 rounded-lg object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-bg-elevated border border-white/10 flex items-center justify-center shrink-0">
                      <svg
                        className="w-6 h-6 text-[#5a5a60]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h2 className="font-[family-name:var(--font-heading)] font-bold text-[#e8e6e3] truncate">
                          {review.title}
                        </h2>
                        <p className="font-[family-name:var(--font-vt323)] text-[#9a9a9e] text-sm">
                          {review.artist}
                          {review.genre && (
                            <span className="text-[#5a5a60]">
                              {" "}
                              &middot; {review.genre}
                            </span>
                          )}
                          {review.release_type && (
                            <span className="text-[#5a5a60]">
                              {" "}
                              &middot; {review.release_type}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Rating Badge */}
                      <div
                        className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold font-[family-name:var(--font-heading)]"
                        style={{
                          background: `${ratingColor}15`,
                          border: `2px solid ${ratingColor}`,
                          color: ratingColor,
                        }}
                      >
                        {review.rating}
                      </div>
                    </div>

                    {/* Snippet */}
                    {review.snippet && (
                      <p className="text-sm text-[#9a9a9e] mt-1 line-clamp-1">
                        {review.snippet}
                      </p>
                    )}

                    {/* Footer: Status + Actions */}
                    <div className="flex items-center gap-3 mt-3">
                      {/* Status Badge */}
                      {review.is_published ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 font-[family-name:var(--font-vt323)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-[family-name:var(--font-vt323)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                          Draft
                        </span>
                      )}

                      <span className="text-xs text-[#5a5a60] font-[family-name:var(--font-vt323)]">
                        {review.review_date || review.created_at?.split("T")[0]}
                      </span>

                      <div className="ml-auto flex items-center gap-2">
                        <Link
                          href={`/reviews/${review.slug}/edit`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-accent-primary hover:bg-accent-primary/10 transition-colors font-[family-name:var(--font-heading)]"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                          Edit
                        </Link>

                        <DeleteReviewButton
                          reviewId={review.id}
                          reviewTitle={review.title}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== My Posts — same manage-from-one-place treatment ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4">
        <div className="space-y-1">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-extrabold text-[#e8e6e3]">
            My Posts
          </h2>
          <p className="font-[family-name:var(--font-vt323)] text-lg text-[#9a9a9e]">
            {posts.length} post{posts.length !== 1 ? "s" : ""} total
          </p>
        </div>

        <Link href="/posts/new" className="btn-y2k btn-y2k-outline shrink-0">
          + Write Post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="panel-xbox p-8 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-xl text-[#5a5a60]">
            No posts yet. Longer than a review, looser than one too.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="panel-xbox p-4 hover-glow">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/posts/${post.slug}`}
                    className="font-[family-name:var(--font-heading)] font-bold text-[#e8e6e3] hover:text-accent-primary transition-colors truncate block"
                  >
                    {post.title}
                  </Link>
                  <p className="text-sm text-[#9a9a9e] mt-1 line-clamp-1">
                    {post.body}
                  </p>

                  <div className="flex items-center gap-3 mt-3">
                    {/* Status badge — same green/yellow pair as reviews.
                        Old rows without the 024 column count as published. */}
                    {post.is_published !== false ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 font-[family-name:var(--font-vt323)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-[family-name:var(--font-vt323)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        Draft
                      </span>
                    )}
                    {post.video_kind && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent-primary/10 text-accent-primary border border-accent-primary/20 font-[family-name:var(--font-vt323)]">
                        ▶ {post.video_kind === "youtube" ? "YouTube" : "TikTok"}
                      </span>
                    )}
                    <span className="text-xs text-[#5a5a60] font-[family-name:var(--font-vt323)]">
                      {post.created_at?.split("T")[0]}
                    </span>

                    <div className="ml-auto flex items-center gap-2">
                      <Link
                        href={`/posts/${post.slug}/edit`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-accent-primary hover:bg-accent-primary/10 transition-colors font-[family-name:var(--font-heading)]"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit
                      </Link>

                      <DeletePostButton
                        postId={post.id}
                        postTitle={post.title}
                        stayOnPage
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
