import Link from "next/link";
import { getDiscoveryFeed } from "@/lib/db/reviews";
import { createClient } from "@/lib/supabase/server";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import LikeButton from "@/components/reviews/LikeButton";

function getRatingColorHex(rating: number): string {
  if (rating === 10) return "#1e90ff";
  if (rating >= 9.5) return "#c084fc";
  if (rating >= 9) return "#c084fc";
  if (rating >= 8) return "#2563eb";
  if (rating >= 7) return "#06b6d4";
  if (rating >= 6) return "#166534";
  if (rating >= 5) return "#84cc16";
  if (rating >= 4) return "#facc15";
  if (rating >= 3) return "#fb923c";
  if (rating >= 2) return "#ef4444";
  return "#737373";
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Type for feed reviews with joined profile data and like aggregates */
interface FeedReview {
  id: string;
  slug: string;
  title: string;
  artist: string;
  rating: number;
  genre: string | null;
  cover_image: string | null;
  created_at: string;
  like_count: number;
  viewer_has_liked: boolean;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    role: "user" | "reviewer" | "admin" | "owner";
  };
}

export default async function DiscoveryFeed() {
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

  const feed = (await getDiscoveryFeed(9, viewerId)) as unknown as FeedReview[];

  if (feed.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="glow-orb" style={{ animationDelay: "3s" }} />
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary">
          Community Feed
        </h2>
        <div className="flex-1 divider-glow" />
        <Link
          href="/reviews"
          className="label-xbox hover:text-accent-primary transition-colors"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {feed.map((review) => {
          const profile = review.profiles;
          const ratingColor = getRatingColorHex(review.rating);
          const isVerified = profile.role !== "user";

          return (
            <Link
              key={review.id}
              href={`/reviews/${review.slug}`}
              className="panel-xbox p-4 sm:p-5 space-y-3 group cursor-pointer hover-glow relative overflow-hidden"
            >
              {/* Verified badge — just the checkmark */}
              {isVerified && (
                <div className="absolute top-1 right-1 z-10">
                  <VerifiedBadge role={profile.role} />
                </div>
              )}

              {/* Cover art */}
              <div className="aspect-square rounded-lg bg-[rgba(30,144,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center relative overflow-hidden group-hover:border-[rgba(255,255,255,0.3)] transition-all">
                {review.cover_image ? (
                  <img
                    src={review.cover_image}
                    alt={`${review.title} cover`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <span className="text-5xl group-hover:scale-110 transition-transform">
                    {"//"}
                  </span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.4)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Genre + Rating */}
              <div className="flex items-center justify-between">
                <span className="label-xbox text-[0.6rem]">
                  {review.genre ?? "Music"}
                </span>
                <div
                  className="w-12 h-12 rounded-lg border bg-[rgba(0,0,0,0.3)] flex items-center justify-center font-[family-name:var(--font-heading)] font-extrabold text-lg transition-all"
                  style={{ color: ratingColor, borderColor: ratingColor }}
                >
                  {review.rating}
                </div>
              </div>

              {/* Title + Artist */}
              <div>
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#e8e6e3] group-hover:text-accent-primary transition-colors">
                  {review.title}
                </h3>
                <p className="text-sm text-[#9a9a9e]">{review.artist}</p>
              </div>

              {/* Author + Like + Time */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name || profile.username}
                    className="w-5 h-5 rounded-full object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-accent-primary uppercase">
                      {(profile.username || "U")[0]}
                    </span>
                  </div>
                )}
                <span className="text-xs text-text-muted flex items-center gap-1 truncate">
                  {profile.display_name || profile.username}
                  {isVerified && <VerifiedBadge role={profile.role} />}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <LikeButton
                    reviewId={review.id}
                    initialCount={review.like_count}
                    initialLiked={review.viewer_has_liked}
                    size="sm"
                  />
                  <span className="text-xs text-text-muted">
                    {timeAgo(review.created_at)}
                  </span>
                </span>
              </div>

              <div className="scan-bar" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
