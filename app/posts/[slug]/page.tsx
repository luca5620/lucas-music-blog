/**
 * Post detail page — one freeform post by one member.
 * Shows the author's identity (with verified badge), the optional
 * video embed, the body, and — when the post is tied to a catalog
 * release — a card linking back to the canonical release page.
 *
 * Embeds are rebuilt from allowlisted templates + the stored platform
 * id (never a raw URL); next.config.ts CSP frame-src allowlists the
 * YouTube and TikTok player hosts, nothing else may be framed.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getPostBySlug, postReleaseArtistName } from "@/lib/db/posts";
import { createClient } from "@/lib/supabase/server";
import ReportButton from "@/components/moderation/ReportButton";
import DeletePostButton from "@/components/posts/DeletePostButton";
import { VerifiedBadge } from "@/components/ui/RoleBadge";

// Community content changes constantly — always render fresh.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post Not Found" };

  const desc =
    post.body.length > 160 ? `${post.body.slice(0, 157)}…` : post.body;

  return {
    title: `${post.title} — post by ${post.author?.username ?? "a member"}`,
    description: desc,
    alternates: {
      canonical: `https://peakmusicreviews.com/posts/${slug}`,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const author = post.author;
  const release = post.release;
  const artistName = postReleaseArtistName(release);
  const isVerified = !!author && author.role !== "user";
  const isAuthor = !!user && user.id === post.user_id;

  return (
    <div className="space-y-6 max-w-3xl mx-auto overflow-hidden">
      {/* Back link */}
      <Link
        href="/posts"
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
      >
        ← Back to Posts
      </Link>

      {/* Main content card */}
      <div className="panel-xbox-glow p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 relative overflow-hidden">
        {/* Title */}
        <h1 className="crt-title text-2xl sm:text-3xl md:text-4xl break-words">
          {post.title}
        </h1>

        {/* Author line */}
        <div className="flex flex-wrap items-center gap-3">
          {author ? (
            <Link
              href={`/profile/${author.username}`}
              className="inline-flex items-center gap-2.5 group"
            >
              {author.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={author.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border border-white/10"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-xs font-bold text-accent-primary uppercase">
                  {(author.username || "U")[0]}
                </span>
              )}
              <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors flex items-center gap-1.5">
                post by{" "}
                <span className="font-bold text-text-primary">
                  {author.display_name || author.username}
                </span>
                {isVerified && <VerifiedBadge role={author.role} />}
              </span>
            </Link>
          ) : (
            <span className="text-sm text-text-muted">post by a member</span>
          )}
          <span className="text-text-muted text-xs">
            {new Date(post.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Report (viewers) / edit + delete (author) */}
        <div className="flex items-center gap-3">
          {isAuthor ? (
            <>
              <Link
                href={`/posts/${post.slug}/edit`}
                className="pixel-text text-xs uppercase tracking-widest text-accent-primary hover:text-accent-glow transition-colors"
              >
                ✎ Edit
              </Link>
              <DeletePostButton postId={post.id} postTitle={post.title} />
            </>
          ) : (
            <ReportButton targetType="post" targetId={post.id} />
          )}
        </div>

        {/* The video embed, if any. src is a fixed template + the stored
            validated id — the pasted URL never reaches the iframe. */}
        {post.video_kind === "youtube" && post.video_id && (
          <div className="aspect-video w-full rounded-lg overflow-hidden border border-border-subtle bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${post.video_id}`}
              title={post.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        )}
        {post.video_kind === "tiktok" && post.video_id && (
          // TikTok's player is portrait: a narrow centered column,
          // ~9:16 for the video plus extra height for caption chrome.
          <div className="mx-auto w-full max-w-[340px]">
            <div className="rounded-lg overflow-hidden border border-border-subtle bg-black">
              <iframe
                src={`https://www.tiktok.com/embed/v2/${post.video_id}`}
                title={post.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="w-full h-[600px]"
              />
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="divider-glow" />

        {/* Post body */}
        <p className="text-text-secondary leading-relaxed text-sm md:text-base whitespace-pre-wrap break-words">
          {post.body}
        </p>

        {/* TIED TO — jump from the post to the release page */}
        {release && (
          <>
            <div className="divider-glow" />
            <div className="card-y2k p-4 sm:p-5 space-y-3 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="glow-orb" />
                <span className="label-xbox">Tied To</span>
              </div>

              <Link
                href={`/releases/${release.slug}`}
                className="flex items-center gap-4 group"
              >
                <span className="w-16 h-16 rounded-lg overflow-hidden bg-bg-elevated shrink-0 border border-border-subtle">
                  {release.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={release.cover_image}
                      alt={`${release.title} cover`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-2xl">
                      💿
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block font-[family-name:var(--font-heading)] font-bold text-text-primary group-hover:text-accent-primary transition-colors truncate">
                    {release.title}
                  </span>
                  {artistName && (
                    <span className="block text-sm text-text-secondary truncate">
                      {artistName}
                    </span>
                  )}
                  <span className="block pixel-text text-xs text-accent-primary group-hover:text-accent-glow transition-colors uppercase tracking-widest mt-1">
                    View release page →
                  </span>
                </span>
              </Link>
            </div>
          </>
        )}

        {/* Scan bar */}
        <div className="scan-bar" />
      </div>
    </div>
  );
}
