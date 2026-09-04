"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

type FollowKind = "user" | "artist" | "release";

interface FollowEntityButtonProps {
  kind: FollowKind;
  entityId: string;
  initialFollowing: boolean;
  accentColor?: string;
  labelFollow?: string;
  labelFollowing?: string;
}

/**
 * Generalized follow button for users, artists, and releases.
 *
 * - Users: POST /api/follow with body `{ followingId }` (matches existing
 *   user-follow endpoint exactly so this can be used as a drop-in for that
 *   too — but note the existing FollowButton in app/profile/[username]
 *   stays as-is). Server returns `{ following: true }` on POST; for an
 *   unfollow we issue DELETE with the same body.
 * - Artists / releases: POST /api/{artists|releases}/{id}/follow (toggle).
 *   Both return `{ following: boolean }` (the new state).
 *
 * Designed to be safe to drop inside a Link wrapper — the click handler
 * stops propagation and prevents default navigation.
 */
export default function FollowEntityButton({
  kind,
  entityId,
  initialFollowing,
  accentColor = "#1e90ff",
  labelFollow,
  labelFollowing,
}: FollowEntityButtonProps) {
  // Callers may pass their own labels; the defaults are translated.
  const t = useTranslations("follow");
  const { user } = useAuth();
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    // Optimistic toggle
    const optimisticNext = !following;
    setFollowing(optimisticNext);

    startTransition(async () => {
      try {
        let res: Response;

        if (kind === "user") {
          // Match the existing /api/follow contract: POST to follow,
          // DELETE to unfollow, both with `{ followingId }` body.
          const method = optimisticNext ? "POST" : "DELETE";
          res = await fetch("/api/follow", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ followingId: entityId }),
          });
        } else {
          // Artist / release endpoints toggle on POST and return
          // `{ following: boolean }` reflecting the new state.
          const path =
            kind === "artist"
              ? `/api/artists/${entityId}/follow`
              : `/api/releases/${entityId}/follow`;
          res = await fetch(path, { method: "POST" });
        }

        if (!res.ok) {
          // Revert on error — silent (no toast yet).
          setFollowing(!optimisticNext);
          return;
        }

        const data = (await res.json().catch(() => null)) as
          | { following?: boolean }
          | null;
        if (data && typeof data.following === "boolean") {
          setFollowing(data.following);
        }
      } catch {
        // Network failure — revert.
        setFollowing(!optimisticNext);
      }
    });
  }

  const filledStyle: React.CSSProperties = {
    background: accentColor,
    color: "#fff",
    borderColor: accentColor,
    boxShadow: `0 3px 0 ${accentColor}80, 0 4px 12px rgba(0,0,0,0.4)`,
  };
  const outlinedStyle: React.CSSProperties = {
    background: "transparent",
    color: accentColor,
    borderColor: `${accentColor}60`,
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={following}
      className="btn-y2k transition-all disabled:opacity-50"
      style={following ? outlinedStyle : filledStyle}
    >
      {isPending
        ? "..."
        : following
          ? (labelFollowing ?? t("following"))
          : (labelFollow ?? t("follow"))}
    </button>
  );
}
