"use client";

/**
 * ListCard — browse-page card for a user list.
 *
 * Shows a fanned stack of up to five item covers, the list title,
 * the author (avatar + username), and item/like counts.
 *
 * This file also exports ListLikeButton — the like toggle used on the
 * list detail page. It mirrors components/reviews/LikeButton.tsx but
 * posts to /api/lists/[listId]/like instead.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { ListSummary } from "@/lib/db/lists";

export default function ListCard({ list }: { list: ListSummary }) {
  const { author } = list;

  return (
    <Link
      href={`/lists/${author.username}/${list.slug}`}
      className="card-y2k block p-4 space-y-3 overflow-hidden"
    >
      {/* --- Fanned stack of covers --- */}
      <div className="flex items-center" aria-hidden>
        {list.item_covers.length > 0 ? (
          list.item_covers.map((cover, i) => (
            <div
              key={i}
              // Negative margin overlaps each cover onto the previous
              // one, Letterboxd-style. zIndex keeps the first on top.
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 border-[rgba(255,255,255,0.12)] bg-bg-elevated shadow-lg first:ml-0 -ml-6 shrink-0"
              style={{ zIndex: list.item_covers.length - i }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))
        ) : (
          // Empty list: show a placeholder slot so cards line up.
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border-2 border-dashed border-[rgba(255,255,255,0.12)] bg-bg-elevated flex items-center justify-center">
            <span className="text-2xl">💿</span>
          </div>
        )}
      </div>

      {/* --- Title --- */}
      <div className="space-y-1">
        <h3 className="font-[family-name:var(--font-heading)] font-extrabold text-[#e8e6e3] leading-snug line-clamp-2">
          {list.title}
        </h3>
        {list.is_ranked && (
          <span className="label-xbox text-[0.55rem]">Ranked</span>
        )}
      </div>

      {/* --- Author + counts --- */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-full overflow-hidden bg-bg-elevated border border-[rgba(255,255,255,0.15)] flex items-center justify-center shrink-0">
            {author.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={author.avatar_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[0.6rem] text-text-muted">
                {author.username.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          <span className="text-xs text-text-secondary truncate">
            {author.display_name || author.username}
          </span>
        </span>

        <span className="pixel-text text-xs text-text-muted uppercase tracking-widest shrink-0">
          {list.item_count} {list.item_count === 1 ? "album" : "albums"}
          {list.like_count > 0 && <> · ♥ {list.like_count}</>}
        </span>
      </div>
    </Link>
  );
}

/* ============================================
   ListLikeButton — like toggle for a list
   (same optimistic-update pattern as the
   review LikeButton)
   ============================================ */

interface ListLikeButtonProps {
  listId: string;
  initialCount: number;
  initialLiked: boolean;
}

export function ListLikeButton({
  listId,
  initialCount,
  initialLiked,
}: ListLikeButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    // Not signed in? Send them to login instead of failing silently.
    if (!user) {
      router.push("/login");
      return;
    }

    if (pending) return;

    // Optimistic update: flip the UI immediately, then reconcile with
    // the server's answer (or roll back on error).
    const prevLiked = liked;
    const prevCount = count;
    const nextLiked = !prevLiked;

    setLiked(nextLiked);
    setCount(prevCount + (nextLiked ? 1 : -1));
    setPending(true);

    try {
      const res = await fetch(`/api/lists/${listId}/like`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to toggle like");
      const data = (await res.json()) as { liked: boolean; count: number };
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={liked ? "Unlike list" : "Like list"}
      aria-pressed={liked}
      className={`inline-flex items-center gap-2 ${
        liked ? "text-[#ff4d6d]" : "text-text-muted hover:text-[#ff4d6d]"
      } hover:scale-110 transition-transform select-none cursor-pointer`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill={liked ? "#ff4d6d" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          liked
            ? { filter: "drop-shadow(0 0 4px rgba(255,77,109,0.7))" }
            : undefined
        }
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span className="font-[family-name:var(--font-heading)] font-bold text-base tabular-nums">
        {count}
      </span>
    </button>
  );
}
