/**
 * /reviews/mine — MY STUFF: the one place to manage everything you
 * made (Luca 2026-09-02: "created debates and lists should be in my
 * reviews section to edit and delete directly on there, a hub for
 * all edits in one area"). Reviews, posts, lists, debates — each
 * with Edit + Delete in the row, drafts included.
 */

import { requireAuth } from "@/lib/auth";
import { getReviewsByUser } from "@/lib/db/reviews";
import { getUserPosts } from "@/lib/db/posts";
import { getProfileById } from "@/lib/db/profiles";
import { getListsByUsername } from "@/lib/db/lists";
import { listDebatesByUser } from "@/lib/db/debates";
import DeleteListButton from "@/components/lists/DeleteListButton";
import DeleteDebateButton from "@/components/debates/DeleteDebateButton";
import { getRatingHex } from "@/lib/rating";
import { formatDate } from "@/lib/dates";
import Link from "next/link";
import type { Metadata } from "next";
import DeleteReviewButton from "@/components/reviews/DeleteReviewButton";
import DeletePostButton from "@/components/posts/DeletePostButton";
// LANGUAGES: messages → reviews.mine (+ common). Metadata stays English.
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "My Stuff",
  robots: { index: false, follow: false },
};

export default async function MyReviewsPage() {
  const user = await requireAuth();
  const [reviews, posts, profile, debates] = await Promise.all([
    getReviewsByUser(user.id, { includeUnpublished: true }),
    getUserPosts(user.id, { includeUnpublished: true }),
    getProfileById(user.id),
    listDebatesByUser(user.id),
  ]);
  // Lists are keyed by username; RLS lets the owner see private ones.
  const lists = profile ? await getListsByUsername(profile.username) : [];
  const t = await getTranslations("reviews.mine");
  const tc = await getTranslations("common");

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold text-[#e8e6e3]">
            {t("title")}
          </h1>
          <p className="font-[family-name:var(--font-vt323)] text-lg text-[#9a9a9e]">
            {t("sub")}
          </p>
          {/* Jump links: four sections, each with its own count */}
          <nav className="flex flex-wrap gap-2 pt-1">
            {[
              { href: "#reviews", label: t("reviewsCount", { n: reviews.length }) },
              { href: "#posts", label: t("postsCount", { n: posts.length }) },
              { href: "#lists", label: t("listsCount", { n: lists.length }) },
              { href: "#debates", label: t("debatesCount", { n: debates.length }) },
            ].map((t) => (
              <a key={t.href} href={t.href} className="tab-y2k">
                {t.label}
              </a>
            ))}
          </nav>
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
          {t("writeReview")}
        </Link>
      </div>

      {/* Reviews List */}
      <h2 id="reviews" className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-extrabold text-[#e8e6e3] pt-2 scroll-mt-24">
        {t("myReviews")}
      </h2>
      {reviews.length === 0 ? (
        <div className="panel-xbox p-8 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-xl text-[#5a5a60]">
            {t("noReviews")}
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

                    {/* Footer: Status + Actions.
                        flex-wrap (Luca 2026-09-02: "the delete button
                        is cut off to the side" on mobile) — this was
                        one rigid row, and the actions group, which
                        GROWS when delete asks to confirm, ran off the
                        card on a phone. Wrapped, the actions drop to
                        their own right-aligned line instead. */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                      {/* Status Badge */}
                      {review.is_published ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 font-[family-name:var(--font-vt323)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          {tc("published")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-[family-name:var(--font-vt323)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                          {tc("draft")}
                        </span>
                      )}

                      <span className="text-xs text-[#5a5a60] font-[family-name:var(--font-vt323)]">
                        {formatDate(review.review_date || review.created_at)}
                      </span>

                      <div className="ml-auto flex items-center gap-2 shrink-0">
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
                          {tc("edit")}
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
          <h2 id="posts" className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-extrabold text-[#e8e6e3] scroll-mt-24">
            {t("myPosts")}
          </h2>
          <p className="font-[family-name:var(--font-vt323)] text-lg text-[#9a9a9e]">
            {t("postsTotal", { n: posts.length })}
          </p>
        </div>

        <Link href="/posts/new" className="btn-y2k btn-y2k-outline shrink-0">
          {t("writePost")}
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="panel-xbox p-8 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-xl text-[#5a5a60]">
            {t("noPosts")}
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

                  {/* Same wrap treatment as the reviews footer above —
                      this row carries an extra video chip, so it ran
                      out of width even sooner on a phone. */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                    {/* Status badge — same green/yellow pair as reviews.
                        Old rows without the 024 column count as published. */}
                    {post.is_published !== false ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 font-[family-name:var(--font-vt323)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        {tc("published")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-[family-name:var(--font-vt323)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        {tc("draft")}
                      </span>
                    )}
                    {post.video_kind && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent-primary/10 text-accent-primary border border-accent-primary/20 font-[family-name:var(--font-vt323)]">
                        ▶ {post.video_kind === "youtube" ? "YouTube" : "TikTok"}
                      </span>
                    )}
                    <span className="text-xs text-[#5a5a60] font-[family-name:var(--font-vt323)]">
                      {formatDate(post.created_at)}
                    </span>

                    <div className="ml-auto flex items-center gap-2 shrink-0">
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
                        {tc("edit")}
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

      {/* ===== My Lists (Luca 2026-09-02) ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4">
        <div className="space-y-1">
          <h2 id="lists" className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-extrabold text-[#e8e6e3] scroll-mt-24">
            {t("myLists")}
          </h2>
          <p className="font-[family-name:var(--font-vt323)] text-lg text-[#9a9a9e]">
            {t("listsTotal", { n: lists.length })}
          </p>
        </div>
        <Link href="/lists/new" className="btn-y2k btn-y2k-outline shrink-0">
          {t("newList")}
        </Link>
      </div>

      {lists.length === 0 ? (
        <div className="panel-xbox p-8 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-xl text-[#5a5a60]">
            {t("noLists")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <div key={list.id} className="panel-xbox p-4 hover-glow">
              <div className="flex items-start gap-4">
                {/* Cover stack — up to three item covers */}
                <div className="flex -space-x-3 shrink-0">
                  {(list.item_covers.length ? list.item_covers.slice(0, 3) : [null]).map(
                    (cover, i) => (
                      <span
                        key={i}
                        className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-bg-elevated flex items-center justify-center"
                        style={{ zIndex: 3 - i }}
                      >
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg">📼</span>
                        )}
                      </span>
                    )
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/lists/${list.author.username}/${list.slug}`}
                    className="font-[family-name:var(--font-heading)] font-bold text-[#e8e6e3] hover:text-accent-primary transition-colors truncate block"
                  >
                    {list.title}
                  </Link>
                  <p className="font-[family-name:var(--font-vt323)] text-[#9a9a9e] text-sm">
                    {t("items", { n: list.item_count })}
                    <span className="text-[#5a5a60]"> &middot; {t("likes", { n: list.like_count })}</span>
                    {list.is_ranked && <span className="text-[#5a5a60]"> &middot; {t("ranked")}</span>}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                    {list.is_public ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 font-[family-name:var(--font-vt323)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        {tc("public")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-[family-name:var(--font-vt323)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        {tc("private")}
                      </span>
                    )}
                    <span className="text-xs text-[#5a5a60] font-[family-name:var(--font-vt323)]">
                      {formatDate(list.created_at)}
                    </span>

                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <Link
                        href={`/lists/${list.author.username}/${list.slug}/edit`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-accent-primary hover:bg-accent-primary/10 transition-colors font-[family-name:var(--font-heading)]"
                      >
                        <EditIcon />
                        {tc("edit")}
                      </Link>
                      <DeleteListButton listId={list.id} listTitle={list.title} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== My Debates (Luca 2026-09-02) ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4">
        <div className="space-y-1">
          <h2 id="debates" className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-extrabold text-[#e8e6e3] scroll-mt-24">
            {t("myDebates")}
          </h2>
          <p className="font-[family-name:var(--font-vt323)] text-lg text-[#9a9a9e]">
            {t("debatesTotal", { n: debates.length })}
          </p>
        </div>
        <Link href="/debates/new" className="btn-y2k btn-y2k-outline shrink-0">
          {t("openDebate")}
        </Link>
      </div>

      {debates.length === 0 ? (
        <div className="panel-xbox p-8 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-xl text-[#5a5a60]">
            {t("noDebates")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {debates.map((debate) => (
            <div key={debate.id} className="panel-xbox p-4 hover-glow">
              <div className="flex items-start gap-4">
                {/* Side covers when set, else the pinned release, else a mic */}
                <div className="flex items-center gap-1 shrink-0">
                  {debate.side_a_release || debate.side_b_release ? (
                    <>
                      <MiniCover url={debate.side_a_release?.cover_image} ring="border-accent-primary/60" />
                      <span className="osd-text text-[9px] opacity-70">VS</span>
                      <MiniCover url={debate.side_b_release?.cover_image} ring="border-accent-rose/60" />
                    </>
                  ) : (
                    <MiniCover url={debate.release?.cover_image} ring="border-white/10" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/debates/${debate.slug}`}
                    className="font-[family-name:var(--font-heading)] font-bold text-[#e8e6e3] hover:text-accent-primary transition-colors truncate block"
                  >
                    {debate.title}
                  </Link>
                  <p className="font-[family-name:var(--font-vt323)] text-[#9a9a9e] text-sm truncate">
                    <span className="text-accent-primary">{debate.side_a_label}</span>
                    <span className="text-[#5a5a60]"> {t("vs")} </span>
                    <span className="text-accent-rose">{debate.side_b_label}</span>
                    <span className="text-[#5a5a60]">
                      {" "}&middot; {t("votes", { n: debate.votes.a + debate.votes.b })}
                      {" "}&middot; {t("takes", { n: debate.message_count })}
                    </span>
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                    {debate.is_published === false ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-[family-name:var(--font-vt323)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        {tc("draft")}
                      </span>
                    ) : debate.status === "open" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 font-[family-name:var(--font-vt323)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        {t("onAir")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/5 text-[#9a9a9e] border border-white/10 font-[family-name:var(--font-vt323)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9a9a9e]" />
                        {t("signedOff")}
                      </span>
                    )}
                    <span className="text-xs text-[#5a5a60] font-[family-name:var(--font-vt323)]">
                      {formatDate(debate.created_at)}
                    </span>

                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <Link
                        href={`/debates/${debate.slug}/edit`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-accent-primary hover:bg-accent-primary/10 transition-colors font-[family-name:var(--font-heading)]"
                      >
                        <EditIcon />
                        {tc("edit")}
                      </Link>
                      <DeleteDebateButton debateId={debate.id} debateTitle={debate.title} stayOnPage />
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

/* Shared bits for the lists/debates rows */

function EditIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function MiniCover({ url, ring }: { url?: string | null; ring: string }) {
  return (
    <span className={`w-12 h-12 rounded-lg overflow-hidden border ${ring} bg-bg-elevated flex items-center justify-center shrink-0`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-lg">🎙️</span>
      )}
    </span>
  );
}
