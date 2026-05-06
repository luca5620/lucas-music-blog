/**
 * FansGrid — Small flex-wrap grid of follower avatar circles.
 * Each avatar links to that follower's profile page. Reusable for artist
 * and release pages.
 * Server component.
 */

import Link from "next/link";
import type { Profile } from "@/lib/types/database";

interface FansGridProps {
  fans: Profile[];
  accentColor: string;
}

export default function FansGrid({ fans, accentColor }: FansGridProps) {
  if (fans.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {fans.map((fan) => {
        const displayName = fan.display_name ?? fan.username;
        const initial = displayName[0]?.toUpperCase() ?? "?";

        return (
          <Link
            key={fan.id}
            href={`/profile/${fan.username}`}
            title={`@${fan.username}`}
            className="block w-12 h-12 rounded-full overflow-hidden border-2 transition-transform hover:scale-110"
            style={{
              borderColor: `${accentColor}60`,
              boxShadow: `0 0 8px ${accentColor}30`,
            }}
          >
            {fan.avatar_url ? (
              <img
                src={fan.avatar_url}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-[family-name:var(--font-space-grotesk)] font-bold text-base"
                style={{
                  background: `${accentColor}25`,
                  color: accentColor,
                }}
              >
                {initial}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
