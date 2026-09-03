import Link from "next/link";
import BackLink from "@/components/ui/BackLink";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { getListBySlug } from "@/lib/db/lists";
import { ListLikeButton } from "@/components/lists/ListCard";

interface PageParams {
  params: Promise<{ username: string; slug: string }>;
}

// Likes and edits should show up right away.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { username, slug } = await params;
  const list = await getListBySlug(username, slug);
  if (!list) notFound(); // real 404, not a soft one — see app/not-found.tsx

  const authorName = list.author.display_name || list.author.username;
  return {
    title: `${list.title} — a list by ${authorName}`,
    description:
      list.description ??
      `${list.title}: ${list.items.length} albums picked by ${authorName}.`,
  };
}

/**
 * /lists/[username]/[slug] — public list detail page.
 *
 * RLS handles privacy for us: if the list is private and the viewer
 * isn't the owner, getListBySlug returns null and we 404.
 */
export default async function ListDetailPage({ params }: PageParams) {
  const { username, slug } = await params;

  // The viewer (may be null) — needed for "have I liked this?" and
  // for showing the Edit link to the owner.
  const user = await getUser();

  const list = await getListBySlug(username, slug, user?.id);
  if (!list) notFound();

  const isOwner = !!user && user.id === list.user_id;
  const authorName = list.author.display_name || list.author.username;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <BackLink
        fallback="/lists"
        label="Back"
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
      />

      {/* --- Header --- */}
      <div className="panel-xbox-glow p-4 sm:p-6 space-y-4 relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {list.is_ranked && (
                <span className="label-xbox text-[0.6rem]">Ranked</span>
              )}
              {!list.is_public && (
                <span className="label-xbox text-[0.6rem]">Private</span>
              )}
            </div>
            <h1 className="crt-title text-2xl sm:text-3xl md:text-4xl break-words">
              {list.title}
            </h1>

            {/* Author byline */}
            <Link
              href={`/profile/${list.author.username}`}
              className="inline-flex items-center gap-2 group"
            >
              <span className="w-7 h-7 rounded-full overflow-hidden bg-bg-elevated border border-[rgba(255,255,255,0.15)] flex items-center justify-center shrink-0">
                {list.author.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={list.author.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-text-muted">
                    {list.author.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="text-sm text-text-secondary group-hover:text-accent-primary transition-colors">
                a list by <span className="font-medium">{authorName}</span>
              </span>
            </Link>
          </div>

          {/* Owner-only edit link */}
          {isOwner && (
            <Link
              href={`/lists/${list.author.username}/${list.slug}/edit`}
              className="btn-y2k btn-y2k-outline shrink-0"
            >
              Edit
            </Link>
          )}
        </div>

        {/* Description. break-words + overflow-wrap:anywhere (Luca
            2026-09-02: the imported playlist's Spotify URL "ran off
            the screen on mobile" — a 70-char unbroken token can't
            wrap on its own). Playlist imports end their description
            with the source URL; that tail is pulled out and drawn as
            a compact "Open on Spotify" chip instead of raw text. */}
        {list.description && (() => {
          const m = /\s*[—-]\s*(https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+)\s*$/.exec(
            list.description
          );
          const text = m ? list.description.slice(0, m.index) : list.description;
          const sourceUrl = m?.[1] ?? null;
          return (
            <div className="space-y-2">
              {text.trim() && (
                <p className="text-text-secondary leading-relaxed text-sm md:text-base whitespace-pre-line break-words [overflow-wrap:anywhere]">
                  {text}
                </p>
              )}
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 pixel-text text-[11px] uppercase tracking-widest text-accent-primary hover:text-accent-glow transition-colors"
                >
                  ▶ Open on Spotify
                </a>
              )}
            </div>
          );
        })()}

        {/* Like button + counts */}
        <div className="flex items-center gap-4">
          <ListLikeButton
            listId={list.id}
            initialCount={list.like_count}
            initialLiked={list.viewer_has_liked}
          />
          <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            {list.items.length} {list.items.length === 1 ? "album" : "albums"}
          </span>
        </div>

        <div className="scan-bar" />
      </div>

      {/* --- Items: poster grid --- */}
      {list.items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {list.items.map((item, index) => {
            // Where this item goes (2026-09-02 — every item used to be
            // a dead card). A normal item links to its release; a
            // playlist import has no release_id yet, so it links to
            // the resolver, which imports the album on first click and
            // redirects to the same place. Neither = not a link.
            const href = item.release_slug
              ? `/releases/${item.release_slug}`
              : item.spotify_album_id
                ? `/releases/spotify/${item.spotify_album_id}`
                : null;
            const cardClass = `card-y2k p-3 space-y-2 overflow-hidden block${
              href ? " hover-glow" : ""
            }`;

            const content = (
              <>
              {/* Cover with a rank badge for ranked lists */}
              <div className="relative aspect-square rounded-lg overflow-hidden bg-bg-elevated border border-[rgba(255,255,255,0.1)] flex items-center justify-center">
                {item.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.cover_image}
                    alt={`${item.title} cover`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-4xl">💿</span>
                )}
                {list.is_ranked && (
                  <span className="absolute top-1.5 left-1.5 w-7 h-7 rounded bg-[rgba(0,0,0,0.75)] border border-[rgba(30,144,255,0.5)] flex items-center justify-center font-[family-name:var(--font-heading)] font-extrabold text-sm text-accent-primary">
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Title + artist */}
              <div className="min-w-0">
                <div className="text-sm text-[#e8e6e3] font-medium truncate">
                  {item.title}
                </div>
                <div className="text-xs text-text-secondary truncate">
                  {item.artist}
                </div>
              </div>

              {/* Per-item note */}
              {item.note && (
                <p className="font-[family-name:var(--font-vt323)] text-sm text-[#9a9a9e] leading-snug border-l-2 border-[rgba(30,144,255,0.4)] pl-2 break-words [overflow-wrap:anywhere]">
                  {item.note}
                </p>
              )}
              </>
            );

            return href ? (
              <Link key={item.id} href={href} className={cardClass}>
                {content}
              </Link>
            ) : (
              <div key={item.id} className={cardClass}>
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel-xbox p-8 text-center">
          <p className="text-text-secondary">This list is empty (for now).</p>
          {isOwner && (
            <p className="font-[family-name:var(--font-vt323)] text-[#9a9a9e] mt-2">
              hit Edit to start adding albums
            </p>
          )}
        </div>
      )}
    </div>
  );
}
