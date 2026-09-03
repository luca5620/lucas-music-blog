"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

interface FollowButtonProps {
  profileId: string;
  initialFollowing: boolean;
  accentColor: string;
}

export default function FollowButton({
  profileId,
  initialFollowing,
  accentColor,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("profile");

  function handleToggle() {
    startTransition(async () => {
      const method = following ? "DELETE" : "POST";

      const res = await fetch("/api/follow", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: profileId }),
      });

      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following);
      }
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className="btn-y2k transition-all disabled:opacity-50"
      style={
        following
          ? {
              background: "transparent",
              color: accentColor,
              borderColor: `${accentColor}60`,
            }
          : {
              background: accentColor,
              color: "#fff",
              borderColor: accentColor,
              boxShadow: `0 3px 0 ${accentColor}80, 0 4px 12px rgba(0,0,0,0.4)`,
            }
      }
    >
      {isPending ? "..." : following ? t("following") : t("follow")}
    </button>
  );
}
