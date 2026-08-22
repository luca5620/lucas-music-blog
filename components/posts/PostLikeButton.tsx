"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { hapticTap } from "@/lib/native";

/**
 * PostLikeButton — the heart on a post (migration 016).
 * Mirrors components/reviews/LikeButton.tsx (same optimistic flip,
 * same visual) against /api/posts/[postId]/like — the codebase
 * convention set by ListLikeButton.
 */

interface PostLikeButtonProps {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
  size?: "sm" | "md";
}

export default function PostLikeButton({
  postId,
  initialCount,
  initialLiked,
  size = "sm",
}: PostLikeButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  const isMd = size === "md";
  const heartSize = isMd ? 22 : 16;
  const textSize = isMd ? "text-base" : "text-xs";
  const gap = isMd ? "gap-2" : "gap-1.5";
  const showCount = isMd || count > 0;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    if (pending) return;

    hapticTap(); // physical click in the app; no-op on web

    const prevLiked = liked;
    const prevCount = count;
    const nextLiked = !prevLiked;
    const nextCount = prevCount + (nextLiked ? 1 : -1);

    setLiked(nextLiked);
    setCount(nextCount);
    setPending(true);

    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
      });
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
      aria-label={liked ? "Unlike post" : "Like post"}
      aria-pressed={liked}
      className={`inline-flex items-center ${gap} ${
        liked ? "text-[#ff4d6d]" : "text-text-muted hover:text-[#ff4d6d]"
      } hover:scale-110 transition-transform select-none cursor-pointer`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={heartSize}
        height={heartSize}
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
      {showCount && (
        <span
          className={`font-[family-name:var(--font-heading)] font-bold ${textSize} tabular-nums`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
