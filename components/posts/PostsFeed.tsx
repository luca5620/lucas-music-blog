/**
 * PostsFeed — the home page Posts module (Luca 2026-08-22: posts had
 * no home on the home page — only profiles and Your Taste surfaced
 * them). Sits between Community Feed and Latest Drops.
 *
 * Server component: fetches the newest posts with author + tied
 * release, plus like counts and the viewer's heart state (migration
 * 016 — zeros before it runs). Card style follows /posts.
 */

import Link from "next/link";
import {
  listPosts,
  getPostLikeCounts,
  getViewerLikedPostIds,
  postReleaseArtistName,
} from "@/lib/db/posts";
import { createClient } from "@/lib/supabase/server";
import { smallCover } from "@/lib/images";
import PostLikeButton from "@/components/posts/PostLikeButton";

/** Card-sized excerpt: first ~180 chars, cut at a word boundary. */
function excerpt(body: string): string {
  if (body.length <= 180) return body;
  const cut = body.slice(0, 180);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 100 ? lastSpace : 180)}…`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function PostsFeed() {
  const posts = await listPosts(6);
  if (posts.length === 0) return null;

  let viewerId: string | undefined;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    viewerId = user?.id;
  } catch {
    // Supabase may not be configured
  }

  const ids = posts.map((p) => p.id);
  const [likeCounts, viewerLiked] = await Promise.all([
    getPostLikeCounts(ids),
    getViewerLikedPostIds(ids, viewerId),
  ]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="glow-orb" style={{ animationDelay: "1.8s" }} />
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary">
          Posts
        </h2>
        <div className="flex-1 divider-glow" />
        <Link
          href="/posts"
          className="label-xbox hover:text-accent-primary transition-colors"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {posts.map((post) => {
          const author = post.author;
          const artistName = postReleaseArtistName(post.release);
          return (
            <Link
              key={post.id}
              href={`/posts/${post.slug}`}
              className="panel-xbox p-4 space-y-3 hover:border-accent-primary/40 transition-colors block"
            >
              {/* Author line */}
              <span className="flex items-center gap-2.5">
                {author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={author.avatar_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-[10px] font-bold text-accent-primary uppercase shrink-0">
                    {(author?.username || "U")[0]}
                  </span>
                )}
                <span className="min-w-0 flex-1 text-sm text-text-secondary truncate">
                  <span className="font-bold text-text-primary">
                    {author?.display_name || author?.username || "a member"}
                  </span>{" "}
                  posted
                </span>
                {post.video_kind && (
                  <span
                    className={`pixel-text text-[10px] border rounded px-1 py-0.5 shrink-0 ${
                      post.video_kind === "youtube"
                        ? "text-accent-rose border-accent-rose/40"
                        : "text-accent-glow border-accent-primary/40"
                    }`}
                  >
                    {post.video_kind === "youtube" ? "▶ YOUTUBE" : "♪ TIKTOK"}
                  </span>
                )}
              </span>

              {/* Title + tied release */}
              <span className="flex items-start gap-3">
                {post.release && (
                  <span className="w-12 h-12 rounded overflow-hidden bg-bg-elevated shrink-0 border border-border-subtle">
                    {post.release.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={smallCover(post.release.cover_image)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-lg">
                        💿
                      </span>
                    )}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-[family-name:var(--font-heading)] font-bold text-text-primary leading-snug break-words">
                    {post.title}
                  </span>
                  {post.release && (
                    <span className="block text-xs text-text-muted truncate">
                      {post.release.title}
                      {artistName ? ` — ${artistName}` : ""}
                    </span>
                  )}
                </span>
              </span>

              {/* The words */}
              <span className="block text-xs text-text-secondary leading-relaxed break-words">
                {excerpt(post.body)}
              </span>

              {/* Heart + when */}
              <span className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                <PostLikeButton
                  postId={post.id}
                  initialCount={likeCounts.get(post.id) ?? 0}
                  initialLiked={viewerLiked.has(post.id)}
                  size="sm"
                />
                <span className="text-xs text-text-muted">
                  {timeAgo(post.created_at)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
