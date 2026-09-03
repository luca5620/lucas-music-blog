import type { Metadata } from "next";
import Link from "next/link";
import { listPosts, postReleaseArtistName } from "@/lib/db/posts";
import { getViewerBlockedIdSet } from "@/lib/db/moderation";
// LANGUAGES: messages → posts.index; dates in the viewer's locale.
import { getLocale, getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Posts",
  description:
    "Freeform posts from the community — edits, essays, deep dives, all tied back to real releases.",
};

// Community content changes constantly — always render fresh.
export const dynamic = "force-dynamic";

/** Card-sized excerpt: first ~180 chars, cut at a word boundary. */
function excerpt(body: string): string {
  if (body.length <= 180) return body;
  const cut = body.slice(0, 180);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 100 ? lastSpace : 180)}…`;
}

/**
 * /posts — the community post wall.
 * Freeform blog-style writeups; looser than reviews, still tied to
 * real releases, optionally carrying one YouTube/TikTok embed.
 */
export default async function PostsPage() {
  const [allPosts, blocked] = await Promise.all([
    listPosts(48),
    getViewerBlockedIdSet(),
  ]);
  // Blocked authors never reach the viewer's wall (App Store 1.2).
  const posts = allPosts.filter((p) => !blocked.has(p.user_id));
  const t = await getTranslations("posts.index");
  const locale = await getLocale();

  return (
    <div className="space-y-6 circuit-bg">
      {/* ══════════ Header ══════════ */}
      <section className="panel-xbox-glow p-4 sm:p-8 space-y-3 relative overflow-hidden">
        <h1 className="crt-title text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="text-sm text-text-secondary max-w-xl">
          {t("sub")}
        </p>
        <div className="pt-1">
          <Link href="/posts/new" className="btn-y2k btn-y2k-primary">
            {t("newPost")}
          </Link>
        </div>
        <div className="scan-bar" />
      </section>

      {/* ══════════ Post feed ══════════ */}
      {posts.length === 0 ? (
        <div className="panel-xbox p-10 text-center space-y-3">
          <p className="osd-text text-sm">{t("noSignal")}</p>
          <p className="text-sm text-text-muted">
            {t("empty")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((post) => {
            const artistName = postReleaseArtistName(post.release);
            return (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="panel-xbox p-4 space-y-3 hover:border-accent-primary/40 transition-colors block"
              >
                <div className="flex items-start gap-3">
                  {/* Tied-release cover thumb */}
                  {post.release && (
                    <span className="w-14 h-14 rounded overflow-hidden bg-bg-elevated shrink-0 border border-border-subtle">
                      {post.release.cover_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.release.cover_image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-xl">
                          💿
                        </span>
                      )}
                    </span>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="font-[family-name:var(--font-heading)] font-bold text-text-primary leading-snug break-words">
                      {post.title}
                    </h2>
                    <p className="text-xs text-text-muted truncate">
                      {t("by", {
                        name: post.author?.display_name || post.author?.username || t("unknown"),
                      })}
                      {post.release && (
                        <>
                          {" · "}
                          {post.release.title}
                          {artistName ? ` — ${artistName}` : ""}
                        </>
                      )}
                    </p>
                  </div>

                  {/* Video-kind badge */}
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
                </div>

                <p className="text-sm text-text-secondary leading-relaxed break-words">
                  {excerpt(post.body)}
                </p>

                <p className="text-xs text-text-muted">
                  {new Date(post.created_at).toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
