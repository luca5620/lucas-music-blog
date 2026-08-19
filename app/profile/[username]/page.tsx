/**
 * Public User Profile Page — "Steam on a CRT"
 *
 * Every profile is a little owned space: the user picks a THEME
 * (a "vintage console" preset — the `theme-*` classes in globals.css
 * re-skin accents, heading fonts, and panel styling inside the
 * wrapper div) and arranges SHOWCASES (ordered blocks: favorites,
 * stats, recent reviews, featured review, badges, lists, anticipated
 * releases).
 *
 * Everything renders on the server; tabs are plain links (?tab=)
 * so switching needs no client JS.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getProfileByUsername,
  getProfileFavorites,
  getProfileReviews,
  getProfileStats,
  isFollowing,
} from "@/lib/db/profiles";
import { getListsByUsername, type ListSummary } from "@/lib/db/lists";
import { getUser } from "@/lib/auth";
import { getRatingHex } from "@/lib/rating";
import FollowButton from "./FollowButton";
import BlockButton from "@/components/moderation/BlockButton";
import { isBlocked } from "@/lib/db/moderation";
import ProfileSongPlayer from "./ProfileSongPlayer";
import RoleBadge from "@/components/ui/RoleBadge";
import FourFavorites from "@/components/profile/FourFavorites";
import RatingHistogram from "@/components/profile/RatingHistogram";
import ListCard from "@/components/lists/ListCard";
import type { Metadata } from "next";
import type {
  Profile,
  ProfileTheme,
  RatingBucket,
  Review,
  ShowcaseType,
} from "@/lib/types/database";

interface Props {
  params: Promise<{ username: string }>;
  /** ?tab=reviews|lists — which profile tab is active. */
  searchParams: Promise<{ tab?: string }>;
}

/** The two profile tabs. Anything else falls back to "reviews". */
type ProfileTab = "reviews" | "lists";

function resolveTab(raw: string | undefined): ProfileTab {
  return raw === "lists" ? raw : "reviews";
}

/* --- Theme → accent hex. Client components (FollowButton, the
       histogram) take a hex prop, so we resolve the theme's primary
       color once here and pass it down. Must match globals.css. --- */
const THEME_ACCENT: Record<ProfileTheme, string> = {
  "crt-blue": "#1e90ff",
  ps3: "#7ec9e8",
  ps4: "#4a90d9",
  "xbox-og": "#5dc21e",
  "xbox-360": "#92c83e",
  wii: "#35b7d8",
  limewire: "#32cd32",
};

/* Wii and LimeWire are LIGHT presets: their theme classes flip the
   text tokens dark, so the page area behind them must go light too —
   otherwise dark text lands on the black tube and vanishes. null =
   keep the normal black page. */
const THEME_PAGE_BG: Record<ProfileTheme, string | null> = {
  "crt-blue": null,
  ps3: null,
  ps4: null,
  "xbox-og": null,
  "xbox-360": null,
  wii: "#e9eaee",
  limewire: "#d8d4c2",
};

const VALID_THEMES = Object.keys(THEME_ACCENT) as ProfileTheme[];

/** Default showcase arrangement for rows created before migration 006. */
const DEFAULT_SHOWCASES: ShowcaseType[] = ["favorites", "stats", "recent_reviews"];

const VALID_SHOWCASES: ShowcaseType[] = [
  "favorites",
  "stats",
  "recent_reviews",
  "featured_review",
  "badges",
  "lists",
  "anticipated",
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    return { title: "User Not Found" };
  }

  return {
    title: profile.display_name ?? profile.username,
    description:
      profile.tagline ??
      profile.bio ??
      `${profile.display_name ?? profile.username} on Peak Music Reviews.`,
    alternates: {
      canonical: `https://peakmusicreviews.com/profile/${username}`,
    },
  };
}

/** Streaming service link config */
const streamingServices = [
  { key: "spotify_url" as const, label: "Spotify", icon: SpotifyIcon },
  { key: "soundcloud_url" as const, label: "SoundCloud", icon: SoundCloudIcon },
  { key: "statsfm_url" as const, label: "stats.fm", icon: StatsFmIcon },
  {
    key: "apple_music_url" as const,
    label: "Apple Music",
    icon: AppleMusicIcon,
  },
];

/* --- Shapes for showcase queries done inline below --- */

interface AnticipatedRelease {
  id: string;
  slug: string;
  title: string;
  cover_image: string | null;
  is_unreleased: boolean | null;
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const { tab: rawTab } = await searchParams;
  const activeTab = resolveTab(rawTab);

  // --- Resolve theme + showcases defensively. Until migration 006
  //     runs, these columns don't exist and come back undefined. ---
  const theme: ProfileTheme = VALID_THEMES.includes(profile.theme)
    ? profile.theme
    : "crt-blue";
  const accentColor = THEME_ACCENT[theme];
  const pageBg = THEME_PAGE_BG[theme];

  const rawShowcases = Array.isArray(profile.showcases)
    ? profile.showcases
    : DEFAULT_SHOWCASES;
  // Keep only known types, drop duplicates, preserve the user's order.
  const showcases = rawShowcases.filter(
    (s, i): s is ShowcaseType =>
      VALID_SHOWCASES.includes(s as ShowcaseType) && rawShowcases.indexOf(s) === i
  );

  const [currentUser, stats, reviews, favorites] = await Promise.all([
    getUser(),
    getProfileStats(profile.id),
    getProfileReviews(profile.id),
    getProfileFavorites(profile.id),
  ]);

  const isOwnProfile = currentUser?.id === profile.id;
  const userFollows =
    currentUser && !isOwnProfile
      ? await isFollowing(currentUser.id, profile.id)
      : false;
  // Has the viewer blocked this profile? Drives the Block/Unblock button.
  const viewerHasBlocked =
    currentUser && !isOwnProfile
      ? await isBlocked(currentUser.id, profile.id)
      : false;

  // --- Showcase data: fetch only what the arrangement needs. ---
  const supabase = await createClient();

  const needsDistribution = showcases.includes("stats");
  const needsFeatured =
    showcases.includes("featured_review") && !!profile.featured_review_id;
  const needsLists = showcases.includes("lists") || activeTab === "lists";
  const needsAnticipated = showcases.includes("anticipated");

  const [distributionRes, featuredRes, profileLists, anticipatedRes] =
    await Promise.all([
      needsDistribution
        ? supabase.rpc("get_rating_distribution", {
            user_uuid: profile.id,
          } as never)
        : Promise.resolve({ data: null }),
      needsFeatured
        ? supabase
            .from("reviews")
            .select("*")
            .eq("id", profile.featured_review_id!)
            .eq("is_published", true)
            .single()
        : Promise.resolve({ data: null }),
      needsLists ? getListsByUsername(profile.username) : Promise.resolve([]),
      needsAnticipated
        ? supabase
            .from("release_follows")
            .select("releases!inner(id, slug, title, cover_image, is_unreleased)")
            .eq("follower_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: null }),
    ]);

  const ratingDistribution: RatingBucket[] = Array.isArray(distributionRes.data)
    ? (distributionRes.data as RatingBucket[])
    : [];
  const featuredReview = (featuredRes.data as Review | null) ?? null;
  const anticipated: AnticipatedRelease[] = (
    (anticipatedRes.data as { releases: AnticipatedRelease | AnticipatedRelease[] }[] | null) ?? []
  )
    .map((row) => (Array.isArray(row.releases) ? row.releases[0] : row.releases))
    .filter((r): r is AnticipatedRelease => !!r);

  const displayName = profile.display_name ?? profile.username;
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const avgRating =
    reviews.length > 0
      ? (
          (reviews as Review[]).reduce((sum, r) => sum + r.rating, 0) /
          reviews.length
        ).toFixed(1)
      : null;

  // --- Sanitize user-controlled banner URL (goes into a CSS url()). ---
  const safeBannerUrl =
    profile.banner_url &&
    (profile.banner_url.startsWith("https://") || profile.banner_url.startsWith("/")) &&
    !/["'()\\]/.test(profile.banner_url)
      ? profile.banner_url
      : null;

  const bannerStyle: React.CSSProperties = safeBannerUrl
    ? {
        backgroundImage: `url(${safeBannerUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        background: `linear-gradient(135deg, ${accentColor}33 0%, #0a0a0c 50%, ${accentColor}1a 100%)`,
      };

  return (
    /* The theme wrapper: every accent-token-based class inside
       (label-xbox, panel glow, poster hover, tab-y2k, osd accents…)
       re-skins to the user's chosen console preset. Light presets
       (Wii, LimeWire) also repaint the page area behind the content,
       because their text tokens flip dark. */
    <div
      className={`theme-${theme} space-y-6 -m-8 sm:-m-8`}
      style={pageBg ? { background: pageBg } : undefined}
    >
      {/* ========== BANNER ========== */}
      <div className="relative h-56 sm:h-80 w-full" style={bannerStyle}>
        {/* Fade the banner into the page at BOTH edges (top + bottom)
            so it doesn't start with a hard line — black normally, the
            light wash on Wii/LimeWire. */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${pageBg ?? "#000000"} 0%, transparent 30%, transparent 55%, ${pageBg ?? "#000000"} 100%)`,
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden">
          <div
            className="h-full w-1/2 animate-[scan-bar_3s_ease-in-out_infinite]"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor}99, transparent)`,
            }}
          />
        </div>
      </div>

      {/* ========== PROFILE HEADER ========== */}
      <div className="px-4 sm:px-8 -mt-20 relative z-10 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
          {/* Avatar */}
          <div
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 shrink-0"
            style={{
              borderColor: accentColor,
              boxShadow: `0 0 24px ${accentColor}60, 0 0 48px ${accentColor}20`,
            }}
          >
            {profile.avatar_url &&
            (profile.avatar_url.startsWith("https://") ||
              profile.avatar_url.startsWith("/")) ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-4xl font-bold"
                style={{ background: `${accentColor}30`, color: accentColor }}
              >
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>

          {/* Name + flair row */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <h1 className="crt-title text-3xl sm:text-5xl flex items-center gap-2">
              <span className="truncate">{displayName}</span>
              <RoleBadge role={profile.role} size="md" />
            </h1>
            <p className="font-[family-name:var(--font-vt323)] text-lg text-text-secondary">
              @{profile.username}
            </p>

            {/* Flair: pronouns · location — quiet, OSD-flavored */}
            {(profile.pronouns || profile.location) && (
              <p className="pixel-text text-sm text-text-muted flex items-center gap-2 flex-wrap">
                {profile.pronouns && <span>{profile.pronouns}</span>}
                {profile.pronouns && profile.location && <span>·</span>}
                {profile.location && <span>📍 {profile.location}</span>}
              </p>
            )}

            {/* Tagline — the one-liner under the name, Steam style */}
            {profile.tagline && (
              <p
                className="text-sm sm:text-base italic"
                style={{ color: accentColor }}
              >
                “{profile.tagline}”
              </p>
            )}
          </div>

          {/* Follow / Edit button */}
          <div className="shrink-0">
            {isOwnProfile ? (
              <Link
                href="/settings/profile"
                className="btn-y2k btn-y2k-outline"
                style={{ borderColor: accentColor, color: accentColor }}
              >
                Customize
              </Link>
            ) : currentUser ? (
              <span className="inline-flex items-center gap-2">
                <FollowButton
                  profileId={profile.id}
                  initialFollowing={userFollows}
                  accentColor={accentColor}
                />
                <BlockButton
                  targetUserId={profile.id}
                  targetUsername={profile.username}
                  initialBlocked={viewerHasBlocked}
                />
              </span>
            ) : (
              <Link href="/login" className="btn-y2k btn-y2k-outline">
                Log in to follow
              </Link>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-text-primary text-sm sm:text-base leading-relaxed max-w-2xl">
            {profile.bio}
          </p>
        )}

        {/* Stats row */}
        <div className="flex gap-6">
          {[
            { label: "Reviews", value: stats.review_count },
            { label: "Followers", value: stats.follower_count },
            { label: "Following", value: stats.following_count },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p
                className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold"
                style={{ color: accentColor }}
              >
                {stat.value}
              </p>
              <p className="font-[family-name:var(--font-vt323)] text-xs text-text-muted uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Streaming links + profile song */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex gap-2 flex-wrap">
            {streamingServices.map(({ key, label, icon: Icon }) => {
              const url = profile[key];
              // Only https links — a stored javascript: URI here would be XSS.
              if (!url || !url.startsWith("https://")) return null;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={label}
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                  style={{
                    background: `${accentColor}15`,
                    border: `1px solid ${accentColor}30`,
                    color: accentColor,
                  }}
                >
                  <Icon />
                </a>
              );
            })}
          </div>

          {profile.profile_song_url && profile.profile_song_title && (
            <ProfileSongPlayer
              url={profile.profile_song_url}
              title={profile.profile_song_title}
              accentColor={accentColor}
            />
          )}
        </div>

        {/* Favorite genres — pill row. Trigger-created accounts have
            NULL here (they never picked genres), not an empty array —
            this crashed every fresh signup's profile until guarded. */}
        {(profile.favorite_genres?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {(profile.favorite_genres ?? []).map((genre) => (
              <span
                key={genre}
                className="px-3 py-1 rounded-full font-[family-name:var(--font-vt323)] text-sm uppercase tracking-wider"
                style={{
                  background: `${accentColor}15`,
                  border: `1px solid ${accentColor}30`,
                  color: accentColor,
                }}
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ========== SHOWCASES — rendered in the user's chosen order ========== */}
      <div className="px-4 sm:px-8 space-y-8">
        {showcases.map((type) => {
          switch (type) {
            case "favorites":
              return (
                <FourFavorites
                  key={type}
                  favorites={favorites}
                  isOwner={isOwnProfile}
                  accentColor={accentColor}
                />
              );

            case "stats":
              return (
                <section key={type} className="space-y-3">
                  <div className="vhs-label inline-block text-sm">SCORECARD</div>
                  <div className="panel-xbox p-5 grid grid-cols-1 sm:grid-cols-4 gap-6 items-center">
                    <div className="text-center">
                      <p
                        className="font-[family-name:var(--font-heading)] text-4xl font-extrabold"
                        style={{ color: accentColor }}
                      >
                        {stats.review_count}
                      </p>
                      <p className="pixel-text text-xs text-text-muted uppercase tracking-widest mt-1">
                        Records rated
                      </p>
                    </div>
                    <div className="text-center">
                      <p
                        className="font-[family-name:var(--font-heading)] text-4xl font-extrabold"
                        style={{ color: accentColor }}
                      >
                        {avgRating ?? "—"}
                      </p>
                      <p className="pixel-text text-xs text-text-muted uppercase tracking-widest mt-1">
                        Average rating
                      </p>
                    </div>
                    {/* Total likes across ALL of this user's reviews —
                        replaced the old NO SIGNAL placeholder cell. */}
                    <div className="text-center">
                      <p
                        className="font-[family-name:var(--font-heading)] text-4xl font-extrabold"
                        style={{ color: accentColor }}
                      >
                        {stats.total_likes_received}
                      </p>
                      <p className="pixel-text text-xs text-text-muted uppercase tracking-widest mt-1">
                        Likes received
                      </p>
                    </div>
                    {/* Histogram simply hides until there are ratings */}
                    {ratingDistribution.length > 0 && (
                      <div>
                        <RatingHistogram
                          distribution={ratingDistribution}
                          accentColor={accentColor}
                        />
                      </div>
                    )}
                  </div>
                </section>
              );

            case "recent_reviews": {
              const recent = (reviews as Review[]).slice(0, 8);
              return (
                <section key={type} className="space-y-3">
                  <div className="vhs-label inline-block text-sm">NOW SHOWING</div>
                  {recent.length === 0 ? (
                    <EmptyState
                      text={
                        isOwnProfile
                          ? "NO SIGNAL — rate your first record to fill this shelf."
                          : "NO SIGNAL — no reviews yet."
                      }
                    />
                  ) : (
                    <div className="poster-grid">
                      {recent.map((review) => (
                        <Link
                          key={review.id}
                          href={`/reviews/${review.slug}`}
                          className="group space-y-1.5"
                          title={`${review.title} — ${review.artist} (${review.rating}/10)`}
                          style={
                            {
                              "--rating-color": getRatingHex(review.rating),
                            } as React.CSSProperties
                          }
                        >
                          <span className="poster">
                            {review.cover_image ? (
                              <img
                                src={review.cover_image}
                                alt={`${review.title} cover`}
                              />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center text-4xl">
                                💿
                              </span>
                            )}
                            <span className="poster-rating">{review.rating}</span>
                          </span>
                          <span className="block">
                            <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)] rating-title-hover">
                              {review.title}
                            </span>
                            <span className="block text-xs text-text-secondary truncate">
                              {review.artist}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              );
            }

            case "featured_review": {
              if (!featuredReview) return null; // unset or unpublished — skip silently
              const ratingColor = getRatingHex(featuredReview.rating);
              return (
                <section key={type} className="space-y-3">
                  <div className="vhs-label inline-block text-sm">FEATURE PRESENTATION</div>
                  <Link
                    href={`/reviews/${featuredReview.slug}`}
                    className="panel-xbox-glow p-5 flex gap-5 items-start group hover-glow"
                  >
                    <span className="poster w-24 h-24 sm:w-32 sm:h-32 shrink-0">
                      {featuredReview.cover_image ? (
                        <img
                          src={featuredReview.cover_image}
                          alt={`${featuredReview.title} cover`}
                        />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-4xl">
                          💿
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span
                          className="rating-badge"
                          style={{ color: ratingColor, borderColor: ratingColor }}
                        >
                          {featuredReview.rating}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-[family-name:var(--font-heading)] text-lg sm:text-xl font-bold text-text-primary truncate group-hover:text-accent-primary transition-colors">
                            {featuredReview.title}
                          </h3>
                          <p className="text-sm text-text-secondary truncate">
                            {featuredReview.artist}
                          </p>
                        </div>
                      </div>
                      {featuredReview.snippet && (
                        <p className="text-sm text-text-secondary leading-relaxed line-clamp-3">
                          {featuredReview.snippet}
                        </p>
                      )}
                    </div>
                  </Link>
                </section>
              );
            }

            case "badges":
              return (
                <section key={type} className="space-y-3">
                  <div className="vhs-label inline-block text-sm">CREDENTIALS</div>
                  <div className="panel-xbox p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
                    {profile.role !== "user" ? (
                      <RoleBadge role={profile.role} size="lg" showLabel />
                    ) : (
                      <span className="pixel-text text-sm text-text-muted">
                        LISTENER — no badges yet
                      </span>
                    )}
                    <span className="pixel-text text-sm text-text-secondary">
                      ON AIR SINCE {memberSince.toUpperCase()}
                    </span>
                    <span className="pixel-text text-sm text-text-secondary">
                      {stats.review_count} TRANSMISSIONS
                    </span>
                  </div>
                </section>
              );

            case "lists": {
              const rail = profileLists.slice(0, 3);
              return (
                <section key={type} className="space-y-3">
                  <div className="vhs-label inline-block text-sm">MIXTAPES</div>
                  {rail.length === 0 ? (
                    <EmptyState
                      text={
                        isOwnProfile
                          ? "NO SIGNAL — build a list and it shows up here."
                          : "NO SIGNAL — no public lists yet."
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {rail.map((list: ListSummary) => (
                        <ListCard key={list.id} list={list} />
                      ))}
                    </div>
                  )}
                </section>
              );
            }

            case "anticipated":
              return (
                <section key={type} className="space-y-3">
                  <div className="vhs-label inline-block text-sm">WAITING ON</div>
                  {anticipated.length === 0 ? (
                    <EmptyState
                      text={
                        isOwnProfile
                          ? "NO SIGNAL — follow a release to start the countdown."
                          : "NO SIGNAL — not waiting on anything."
                      }
                    />
                  ) : (
                    <div className="poster-grid">
                      {anticipated.map((rel) => (
                        <Link
                          key={rel.id}
                          href={`/releases/${rel.slug}`}
                          className="group space-y-1.5"
                          title={rel.title}
                        >
                          <span className="poster">
                            {rel.cover_image ? (
                              <img src={rel.cover_image} alt={`${rel.title} cover`} />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center text-4xl">
                                📼
                              </span>
                            )}
                            {rel.is_unreleased && (
                              <span className="poster-unreleased">Unreleased</span>
                            )}
                          </span>
                          <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)]">
                            {rel.title}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              );

            default:
              return null;
          }
        })}
      </div>

      {/* Glowing divider between showcases and the tab section */}
      <div className="mx-4 sm:mx-8">
        <div className="divider-glow" />
      </div>

      {/* ========== TABBED SECTION: Reviews | Lists ========== */}
      <div className="px-4 sm:px-8 pb-8 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { key: "reviews", label: "Reviews" },
              { key: "lists", label: "Lists" },
            ] as { key: ProfileTab; label: string }[]
          ).map((t) => (
            <Link
              key={t.key}
              href={
                t.key === "reviews"
                  ? `/profile/${profile.username}`
                  : `/profile/${profile.username}?tab=${t.key}`
              }
              scroll={false}
              className={`tab-y2k ${activeTab === t.key ? "tab-active" : ""}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* ----- Reviews tab (default) ----- */}
        {activeTab === "reviews" &&
          ((reviews as Review[]).length === 0 ? (
            <EmptyState text="NO SIGNAL — no reviews yet." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(reviews as Review[]).map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ))}

        {/* ----- Lists tab ----- */}
        {activeTab === "lists" &&
          (profileLists.length === 0 ? (
            <EmptyState text="NO SIGNAL — no lists yet." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profileLists.map((list) => (
                <ListCard key={list.id} list={list} />
              ))}
            </div>
          ))}
      </div>

      {/* ========== MEMBER SINCE ========== */}
      <div className="px-4 sm:px-8 pb-8">
        <p className="font-[family-name:var(--font-vt323)] text-sm text-text-muted text-center">
          Member since {memberSince}
        </p>
      </div>
    </div>
  );
}

/* ============================================
   Empty state — CRT static box
   ============================================ */

function EmptyState({ text }: { text: string }) {
  return (
    <div className="panel-xbox p-8 text-center">
      <p className="osd-text text-sm opacity-70">{text}</p>
    </div>
  );
}

/* ============================================
   Review Card (inline)
   ============================================ */

function ReviewCard({ review }: { review: Review }) {
  const ratingColor = getRatingHex(review.rating);

  return (
    <Link
      href={`/reviews/${review.slug}`}
      className="panel-xbox p-4 sm:p-5 space-y-4 group cursor-pointer hover-glow relative overflow-hidden"
    >
      {/* Cover art */}
      <div className="aspect-square rounded-lg bg-bg-elevated border border-white/10 flex items-center justify-center relative overflow-hidden group-hover:border-white/30 transition-all">
        {review.cover_image ? (
          <img
            src={review.cover_image}
            alt={`${review.title} cover`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <span className="text-5xl group-hover:scale-110 transition-transform">
            💿
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.4)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

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

      <div>
        <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text-primary group-hover:text-accent-primary transition-colors">
          {review.title}
        </h3>
        <p className="text-sm text-text-secondary">{review.artist}</p>
      </div>

      <div className="scan-bar" />
    </Link>
  );
}

/* ============================================
   Streaming Service Icons (inline SVGs)
   ============================================ */

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function SoundCloudIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1zm-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.282c.013.06.045.094.104.094.057 0 .09-.038.104-.094l.21-1.282-.21-1.332c-.014-.057-.047-.094-.104-.094zm1.794-1.418c-.063 0-.098.046-.107.1l-.218 2.744.218 2.637c.009.06.044.1.107.1.063 0 .098-.04.107-.1l.255-2.637-.255-2.744c-.009-.06-.044-.1-.107-.1zm.882-.4c-.07 0-.108.049-.114.109l-.204 3.153.204 2.968c.006.065.044.109.114.109.068 0 .108-.044.114-.109l.232-2.968-.232-3.153c-.006-.06-.046-.109-.114-.109zm.874-.238c-.078 0-.116.053-.121.115l-.191 3.391.191 3.123c.005.069.043.115.121.115.076 0 .116-.046.121-.115l.222-3.123-.222-3.391c-.005-.062-.045-.115-.121-.115zm.924-.2c-.084 0-.123.06-.127.127l-.178 3.591.178 3.199c.004.074.043.127.127.127.083 0 .123-.053.127-.127l.203-3.199-.203-3.591c-.004-.067-.044-.127-.127-.127zm.941-.1c-.092 0-.131.062-.134.131l-.165 3.691.165 3.254c.003.076.042.131.134.131.09 0 .131-.055.134-.131l.19-3.254-.19-3.691c-.003-.069-.044-.131-.134-.131zm.986.05c-.097 0-.138.065-.14.138l-.152 3.541.152 3.283c.002.08.043.138.14.138.096 0 .138-.058.14-.138l.172-3.283-.172-3.541c-.002-.073-.044-.138-.14-.138zm1.024-.1c-.104 0-.145.07-.146.146l-.14 3.591.14 3.296c.001.084.042.146.146.146.103 0 .145-.062.146-.146l.16-3.296-.16-3.591c-.001-.076-.043-.146-.146-.146zm1.056.06c-.11 0-.151.074-.152.153l-.127 3.481.127 3.31c0 .088.042.153.152.153.109 0 .151-.065.152-.153l.148-3.31-.148-3.481c-.001-.079-.043-.153-.152-.153zm2.143.635c-.16 0-.2.092-.2.173l-.098 2.783.098 3.246c0 .095.04.173.2.173.158 0 .2-.078.2-.173l.114-3.246-.114-2.783c0-.081-.042-.173-.2-.173zm-1.082-.527c-.118 0-.159.079-.16.16l-.114 3.348.114 3.315c0 .091.042.16.16.16.117 0 .158-.069.16-.16l.131-3.315-.131-3.348c-.002-.081-.043-.16-.16-.16zm2.151.259c-.163 0-.212.099-.212.187l-.085 2.876.085 3.226c0 .101.049.187.212.187.161 0 .211-.086.212-.187l.099-3.226-.099-2.876c-.001-.088-.051-.187-.212-.187zm1.064-.371c-.174 0-.222.103-.223.197l-.072 3.06.072 3.204c.001.105.049.197.223.197.172 0 .222-.092.223-.197l.085-3.204-.085-3.06c-.001-.094-.051-.197-.223-.197zm1.085-.182c-.182 0-.232.107-.232.207l-.059 3.242.059 3.177c0 .111.05.207.232.207.181 0 .232-.096.232-.207l.069-3.177-.069-3.242c0-.1-.051-.207-.232-.207zm1.138.174c-.187 0-.243.113-.243.218l-.046 2.848.046 3.144c0 .115.056.218.243.218.186 0 .242-.103.243-.218l.054-3.144-.054-2.848c-.001-.105-.057-.218-.243-.218zm1.072-.473c-.19 0-.252.119-.252.228l-.034 3.093.034 3.11c0 .119.062.228.252.228.189 0 .252-.109.252-.228l.039-3.11-.039-3.093c0-.109-.063-.228-.252-.228zm1.125.12c-.196 0-.26.123-.26.236l-.021 2.953.021 3.073c0 .123.064.236.26.236.195 0 .26-.113.26-.236l.025-3.073-.025-2.953c0-.113-.065-.236-.26-.236zm1.094-.358c-.201 0-.269.129-.27.246l-.01 3.09.01 3.04c.001.128.069.246.27.246.2 0 .268-.118.27-.246l.01-3.04-.01-3.09c-.002-.117-.07-.246-.27-.246zm1.144.267c-.207 0-.276.132-.276.252v5.834c0 .131.069.252.276.252.206 0 .276-.121.276-.252l.006-2.903-.006-2.931c0-.12-.07-.252-.276-.252zm3.056.702c-.263 0-.477.136-.563.34-.167-.057-.349-.091-.539-.091-1.064 0-1.93.855-1.93 1.905v3.444c0 .131.069.253.276.253h5.282c.231 0 .418-.187.418-.418v-3.279c0-2.279-1.5-4.154-2.944-4.154z" />
    </svg>
  );
}

function StatsFmIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <rect x="2" y="13" width="4" height="9" rx="1" />
      <rect x="8" y="9" width="4" height="13" rx="1" />
      <rect x="14" y="5" width="4" height="17" rx="1" />
      <rect x="20" y="2" width="4" height="20" rx="1" />
    </svg>
  );
}

function AppleMusicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525-.015 1.05-.04 1.573-.112.724-.1 1.418-.3 2.042-.673 1.2-.714 1.98-1.734 2.353-3.055.138-.487.208-.99.26-1.492.06-.6.07-1.2.074-1.8V8.017v-1.893zM11.16 17.467v-5.695l.012-.054V8.39c0-.28.1-.47.36-.58.123-.052.254-.082.384-.112l4.612-.96c.35-.073.61.07.68.37.01.05.014.1.014.152v6.818c0 .2-.038.394-.137.574-.153.28-.394.437-.7.5l-1.586.33c-.72.15-1.32-.25-1.38-.98-.04-.46.15-.83.56-1.05.2-.11.42-.17.64-.22l1-.21c.2-.04.34-.18.37-.38.01-.05.01-.1.01-.15V9.26c0-.1-.04-.17-.14-.2-.03-.01-.06-.01-.09 0l-3.31.69c-.18.04-.28.14-.3.33v.06l-.01 7.35c0 .26-.04.52-.17.75-.18.34-.46.53-.83.58l-1.32.27c-.78.16-1.43-.3-1.45-1.08-.02-.5.18-.89.6-1.1.18-.1.39-.16.59-.2l.82-.17c.24-.05.38-.2.4-.44v-.16z" />
    </svg>
  );
}
