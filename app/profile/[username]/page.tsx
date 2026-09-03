/**
 * Public User Profile Page — "Steam on a CRT"
 *
 * Every profile is a little owned space: the user picks a THEME
 * (a preset — the `theme-*` classes in globals.css re-skin accents,
 * heading fonts, and panel styling inside the wrapper div) and
 * arranges SHOWCASES (ordered blocks: stats, recent reviews,
 * featured review, badges, lists, anticipated releases…).
 *
 * Everything renders on the server; tabs are plain links (?tab=)
 * so switching needs no client JS.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getProfileBadges,
  getProfileByUsername,
  getProfileReviews,
  getProfileStats,
  isFollowing,
} from "@/lib/db/profiles";
import { getListsByUsername, type ListSummary } from "@/lib/db/lists";
import { getUser } from "@/lib/auth";
import { getRatingHex, getRatingColor, formatRating } from "@/lib/rating";
import FollowButton from "./FollowButton";
import BlockButton from "@/components/moderation/BlockButton";
import { isBlocked } from "@/lib/db/moderation";
import ProfileSongPlayer from "./ProfileSongPlayer";
import RoleBadge from "@/components/ui/RoleBadge";
import RatingHistogram from "@/components/profile/RatingHistogram";
import ListeningShowcase from "@/components/profile/ListeningShowcase";
import SongOfDayShowcase from "@/components/profile/SongOfDayShowcase";
import ProfileReviewsGrid from "@/components/profile/ProfileReviewsGrid";
import ThemeBackdrop from "@/components/profile/ThemeBackdrop";
import ThemeLiquidSync from "@/components/profile/ThemeLiquidSync";
import ProfileBadges from "@/components/profile/ProfileBadges";
import PlatformIcon from "@/components/profile/PlatformIcons";
import { resolveVisibleLinks } from "@/lib/social-links";
import { getUserPosts } from "@/lib/db/posts";
import type { StreakIcon } from "@/components/profile/StreakIndicator";
import ListCard from "@/components/lists/ListCard";
import PlaylistEmbed from "@/components/playlists/PlaylistEmbed";
import type { Metadata } from "next";
import type {
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

/** Alpha masks for the banner's edge fade: full image through the
    middle, eased falloff toward every edge — so the banner blends
    into whatever moves behind it instead of drowning under a painted
    black band. The TOP mirrors the bottom's long dissolve (and the
    nav drops its separator line here), and the SIDES fade too
    (tighter stops — the banner is much wider than tall), the two
    gradients intersected via mask-composite so all four edges soften.
    PROFILES ONLY per Luca 2026-08-24; the artist page keeps its
    tighter top-only treatment. */
/* The edges bottom out at ~0.5 alpha instead of 0: a full
   dissolve-to-nothing erased the silhouette entirely, so the curved
   corners Luca asked for could never show (clipping invisible pixels
   does nothing). With an opacity floor, the border-radius cuts a
   visible curved edge while everything inside it still fades softly
   into the moving background. */
const BANNER_FADE_MASK_Y =
  "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.62) 7%, rgba(0,0,0,0.76) 15%, rgba(0,0,0,0.9) 24%, black 34%, black 66%, rgba(0,0,0,0.9) 76%, rgba(0,0,0,0.76) 85%, rgba(0,0,0,0.62) 93%, rgba(0,0,0,0.5) 100%)";
const BANNER_FADE_MASK_X =
  "linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.68) 3%, rgba(0,0,0,0.8) 6%, rgba(0,0,0,0.92) 10%, black 14%, black 86%, rgba(0,0,0,0.92) 90%, rgba(0,0,0,0.8) 94%, rgba(0,0,0,0.68) 97%, rgba(0,0,0,0.55) 100%)";

/** The two profile tabs. Anything else falls back to "reviews". */
type ProfileTab = "reviews" | "lists" | "posts";

function resolveTab(raw: string | undefined): ProfileTab {
  return raw === "lists" || raw === "posts" ? raw : "reviews";
}

/* --- Theme → accent hex. Client components (FollowButton, the
       histogram) take a hex prop, so we resolve the theme's primary
       color once here and pass it down. Must match globals.css. --- */
const THEME_ACCENT: Record<ProfileTheme, string> = {
  "crt-blue": "#1e90ff",
  ps2: "#8ba7e8",
  ps3: "#7ec9e8",
  ps4: "#4a90d9",
  "xbox-og": "#5dc21e",
  "xbox-360": "#92c83e",
  wii: "#35b7d8",
  limewire: "#32cd32",
  bleach: "#e3342f",
  "daft-punk": "#f0b93c",
};

/* Wii and LimeWire are LIGHT presets: their theme classes flip the
   text tokens dark, so the page area behind them must go light too —
   otherwise dark text lands on the black tube and vanishes. null =
   keep the normal black page. */
const THEME_PAGE_BG: Record<ProfileTheme, string | null> = {
  "crt-blue": null,
  ps2: null,
  ps3: null,
  ps4: null,
  "xbox-og": null,
  "xbox-360": null,
  wii: "#e9eaee",
  limewire: "#d8d4c2",
  bleach: null,
  "daft-punk": null,
};

const VALID_THEMES = Object.keys(THEME_ACCENT) as ProfileTheme[];

/** Default showcase arrangement for rows created before migration 006.
    "favorites" removed 2026-08-26 (Luca) — dropping it from this list
    and VALID_SHOWCASES is what hides the block on every profile,
    including rows that still carry it in their showcases array. */
const DEFAULT_SHOWCASES: ShowcaseType[] = ["stats", "recent_reviews"];

/* "badges" (the CREDENTIALS block) left this list 2026-09-02 (Luca):
   badges now live under the username on every profile, so the block
   is gone the same way "favorites" went — rows still carrying it just
   don't render it. */
const VALID_SHOWCASES: ShowcaseType[] = [
  "stats",
  "recent_reviews",
  "featured_review",
  "lists",
  "anticipated",
  "listening",
  "listening_stats",
  "sotd",
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) notFound(); // real 404, not a soft one — see app/not-found.tsx

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

/* Connected-platform links (Spotify … Discord) are resolved by
   lib/social-links.ts — which ones show, and in what order, is the
   member's `visible_links` choice (migration 039). */

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

  // --- Showcase data: fetch only what the arrangement needs. ---
  const supabase = await createClient();

  const needsDistribution = showcases.includes("stats");
  // Featured review works even with nothing pinned: fall back to the
  // user's highest-rated published review so enabling the showcase
  // always shows SOMETHING (a pin in Settings overrides the pick).
  const needsFeatured = showcases.includes("featured_review");
  const needsLists = showcases.includes("lists") || activeTab === "lists";
  const needsAnticipated = showcases.includes("anticipated");

  // ONE batch for everything that only needs the profile row. This
  // page used to do these across four sequential awaits — on a phone
  // over cell data every extra round trip is felt, and profiles were
  // the slowest pages on the site because of it.
  const [
    currentUser,
    stats,
    reviews,
    profilePosts,
    distributionRes,
    featuredRes,
    profileLists,
    anticipatedRes,
    awardedBadges,
  ] = await Promise.all([
    getUser(),
    getProfileStats(profile.id),
    getProfileReviews(profile.id),
    // Posts tab data — only fetched when that tab is open.
    activeTab === "posts" ? getUserPosts(profile.id) : Promise.resolve([]),
    needsDistribution
      ? supabase.rpc("get_rating_distribution", {
          user_uuid: profile.id,
        } as never)
      : Promise.resolve({ data: null }),
    needsFeatured
      ? profile.featured_review_id
        ? supabase
            .from("reviews")
            .select("*")
            .eq("id", profile.featured_review_id)
            .eq("is_published", true)
            .maybeSingle()
        : supabase
            .from("reviews")
            .select("*")
            .eq("user_id", profile.id)
            .eq("is_published", true)
            .order("rating", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
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
    // Event badges (migration 039) — [] until the table exists.
    getProfileBadges(profile.id),
  ]);

  const isOwnProfile = currentUser?.id === profile.id;
  // Streaming-links privacy (migration 027, Settings checkbox): the
  // links stay saved, visitors just don't see the icon row. The
  // owner still sees it, tagged "hidden from visitors".
  const linksHidden = profile.hide_streaming_links === true;
  // Which platform icons show and in what order — the member's own
  // pick (visible_links), validated against each platform's domain
  // allow-list so a bad stored value renders nothing.
  const visibleLinks = resolveVisibleLinks(profile);
  const hasStreamingLinks = visibleLinks.length > 0;
  // Viewer-relative flags need currentUser, so they get a second
  // (small) batch — still one round trip for both together.
  const [userFollows, viewerHasBlocked] =
    currentUser && !isOwnProfile
      ? await Promise.all([
          isFollowing(currentUser.id, profile.id),
          isBlocked(currentUser.id, profile.id),
        ])
      : [false, false];

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
      ? formatRating(
          (reviews as Review[]).reduce((sum, r) => sum + r.rating, 0) /
            reviews.length
        )
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
      // relative + isolate: the animated ThemeBackdrop sits at -z
      // INSIDE this wrapper's own stacking context, above the page
      // background but below every piece of content.
      // Full-bleed: the negative margins must EXACTLY cancel
      // .crt-screen's padding (1rem on phones, 2rem/1.75rem on sm+).
      // -m-8 everywhere overshot by 1rem per side on phones — the page
      // went wider than the screen, so the app wobbled sideways and
      // the banner hung past the borders.
      className={`theme-${theme} relative isolate space-y-6 -mx-4 -mt-4 -mb-8 sm:-mx-8 sm:-mt-7`}
      style={pageBg ? { background: pageBg } : undefined}
    >
      {/* Animated console-dashboard atmosphere for this theme */}
      <ThemeBackdrop theme={theme} />
      {/* Recolor the site-wide liquid (room glow + canvas wash) to
          this profile's theme while the page is open */}
      <ThemeLiquidSync theme={theme} />

      {/* ========== BANNER ==========
          A rounded CARD (radius + clip + faint dark ground on the
          container, final banner form per Luca 2026-08-24): the image
          fades toward the card's own ground via the alpha masks, so
          there's no hard cutoff, and the curve is the card edge
          itself. The ground matters — when the radius lived on the
          image layer alone, the square container's corner notches
          were bare windows to the liquid behind, glowing awkwardly
          next to the curved image. */}
      <div
        className="relative h-44 sm:h-80 w-full rounded-2xl overflow-hidden border bg-[rgba(9,11,15,0.45)]"
        // The same faint accent hairline every panel wears — without
        // it the card floated chrome-less next to bordered modules
        // and read slightly unfinished.
        style={{ borderColor: `${accentColor}2e` }}
      >
        <div
          className="absolute inset-0"
          style={{
            ...bannerStyle,
            WebkitMaskImage: `${BANNER_FADE_MASK_Y}, ${BANNER_FADE_MASK_X}`,
            maskImage: `${BANNER_FADE_MASK_Y}, ${BANNER_FADE_MASK_X}`,
            // Intersect, not add: a pixel survives only where BOTH
            // gradients are opaque, so every edge fades. (source-in
            // is WebKit's spelling of intersect.)
            WebkitMaskComposite: "source-in",
            maskComposite: "intersect",
          }}
        />

        {/* Inset by the card radius (left/right-4 = 16px = rounded-2xl)
            so the streak lives only on the STRAIGHT span of the bottom
            edge — full-width it shot straight through the corner
            curves and looked detached from the card (Luca). */}
        <div className="absolute bottom-0 left-4 right-4 h-[1px] overflow-hidden rounded-full">
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
            className="w-24 h-24 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 shrink-0"
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

            {/* Badges — reviews trophy, likes trophy, years of service,
                plus any awarded event badges. Hover / tap for detail.
                Badges the member hid in Settings (migration 040) are
                skipped for visitors and dimmed for the owner. */}
            <ProfileBadges
              reviewCount={stats.review_count}
              likesReceived={stats.total_likes_received}
              createdAt={profile.created_at}
              awarded={awardedBadges}
              accentColor={accentColor}
              hidden={profile.hidden_badges ?? null}
              isOwner={isOwnProfile}
            />

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

        {/* Stats row. Privacy by design: follower/following counts are
            clickable ONLY on your own profile (they link to the private
            /connections page) — visitors just see numbers, never lists. */}
        <div className="flex gap-6">
          {[
            { label: "Reviews", value: stats.review_count, link: false },
            { label: "Followers", value: stats.follower_count, link: true },
            { label: "Following", value: stats.following_count, link: true },
          ].map((stat) => {
            const inner = (
              <>
                <p
                  className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold"
                  style={{ color: accentColor }}
                >
                  {stat.value}
                </p>
                <p className="font-[family-name:var(--font-vt323)] text-xs text-text-muted uppercase tracking-wider">
                  {stat.label}
                </p>
              </>
            );
            return isOwnProfile && stat.link ? (
              <Link
                key={stat.label}
                href="/connections"
                className="text-center hover:opacity-75 transition-opacity"
                title="View your connections"
              >
                {inner}
              </Link>
            ) : (
              <div key={stat.label} className="text-center">
                {inner}
              </div>
            );
          })}
        </div>

        {/* Streaming links + profile song */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {(!linksHidden || isOwnProfile) && (
          <div className="flex gap-2 flex-wrap items-center">
            {/* Left-to-right in the member's chosen order. Every url
                here already passed the platform's https + domain
                check in resolveVisibleLinks. */}
            {visibleLinks.map(({ platform, url }) => (
              <a
                key={platform.key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={platform.label}
                aria-label={platform.label}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                style={{
                  background: `${accentColor}15`,
                  border: `1px solid ${accentColor}30`,
                  color: accentColor,
                }}
              >
                <PlatformIcon platform={platform.key} />
              </a>
            ))}
            {/* Owner-only reminder that the row is private — visitors
                never reach this branch when linksHidden is on. */}
            {linksHidden && hasStreamingLinks && (
              <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
                Hidden from visitors
              </span>
            )}
          </div>
          )}

          {profile.profile_song_url && profile.profile_song_title && (
            <ProfileSongPlayer
              url={profile.profile_song_url}
              title={profile.profile_song_title}
              accentColor={accentColor}
            />
          )}

          {/* Featured Spotify playlist (migration 035, Luca 2026-09-02):
              the profile's own player, under the profile song. Visitors
              can save it as one of their lists straight from here. */}
          {profile.featured_playlist_id && (
            <div className="pt-2">
              <PlaylistEmbed
                playlistId={profile.featured_playlist_id}
                title={`${profile.display_name || profile.username}'s playlist`}
                label="Featured Playlist"
              />
            </div>
          )}
        </div>

        {/* Favorite genres removed 2026-08-22 (Luca) — the editor and
            this pill row both; old favorite_genres rows just sit
            untouched in the DB. */}
      </div>

      {/* ========== SHOWCASES — rendered in the user's chosen order ========== */}
      <div className="px-4 sm:px-8 space-y-8">
        {showcases.map((type) => {
          switch (type) {
            case "stats":
              return (
                <section key={type} className="space-y-3">
                  <div className="vhs-label inline-block text-sm">RATING OVERVIEW</div>
                  <div className="panel-xbox p-5 space-y-6">
                    {/* The three headline stats — evenly spaced, centered,
                        original 3-column sizing. */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                      <div className="text-center">
                        <p
                          className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold"
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
                          className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold"
                          style={{ color: accentColor }}
                        >
                          {avgRating ?? "—"}
                        </p>
                        <p className="pixel-text text-xs text-text-muted uppercase tracking-widest mt-1">
                          Average rating
                        </p>
                      </div>
                      {/* Total likes across ALL of this user's reviews */}
                      <div className="text-center">
                        <p
                          className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold"
                          style={{ color: accentColor }}
                        >
                          {stats.total_likes_received}
                        </p>
                        <p className="pixel-text text-xs text-text-muted uppercase tracking-widest mt-1">
                          Likes received
                        </p>
                      </div>
                    </div>

                    {/* Histogram gets its own full-width row below the
                        stats; hidden entirely until ratings exist. */}
                    {ratingDistribution.length > 0 && (
                      <RatingHistogram
                        distribution={ratingDistribution}
                        accentColor={accentColor}
                      />
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
                          className={`rating-badge ${getRatingColor(featuredReview.rating)}`}
                          style={{ color: ratingColor, borderColor: ratingColor }}
                        >
                          {formatRating(featuredReview.rating)}
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

            case "listening":
              // ON ROTATION — now playing / last played (stats.fm).
              // Suspense: this block awaits an EXTERNAL API — it must
              // stream in after the page, never hold the page back.
              return (
                <Suspense key={type} fallback={<ShowcaseSkeleton />}>
                  <ListeningShowcase
                    mode="track"
                    statsfmUrl={profile.statsfm_url}
                    isOwner={isOwnProfile}
                    accentColor={accentColor}
                  />
                </Suspense>
              );

            case "listening_stats":
              // ALL-TIME LISTENING — lifetime minutes + streams (stats.fm).
              return (
                <Suspense key={type} fallback={<ShowcaseSkeleton />}>
                  <ListeningShowcase
                    mode="stats"
                    statsfmUrl={profile.statsfm_url}
                    isOwner={isOwnProfile}
                    accentColor={accentColor}
                  />
                </Suspense>
              );

            case "sotd":
              // SONG OF THE DAY — daily pick + animated streak
              // (migrations 009 + 010).
              return (
                <Suspense key={type} fallback={<ShowcaseSkeleton />}>
                  <SongOfDayShowcase
                    userId={profile.id}
                    isOwner={isOwnProfile}
                    streakIcon={(profile.streak_icon ?? "flame") as StreakIcon}
                  />
                </Suspense>
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
              { key: "posts", label: "Posts" },
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
            /* View-switchable (detailed/posters/compact) — the choice
               persists and is shared with the reviews index. */
            <ProfileReviewsGrid reviews={reviews as Review[]} />
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

        {/* ----- Posts tab ----- */}
        {activeTab === "posts" &&
          (profilePosts.length === 0 ? (
            <EmptyState text="NO SIGNAL — no posts yet." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {profilePosts.map((p) => (
                <Link
                  key={p.id}
                  href={`/posts/${p.slug}`}
                  className="panel-xbox p-4 space-y-2 hover-glow block"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-[family-name:var(--font-heading)] text-base font-bold text-text-primary line-clamp-2">
                      {p.title}
                    </h3>
                    {p.video_kind && (
                      <span className="label-xbox text-[0.55rem] shrink-0">
                        ▶ {p.video_kind === "youtube" ? "YouTube" : "TikTok"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line line-clamp-4">
                    {p.body}
                  </p>
                  <p className="text-xs text-text-muted">
                    {new Date(p.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </Link>
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

/** Streaming placeholder for the slow (external-data) showcases. */
function ShowcaseSkeleton() {
  return (
    <section className="space-y-3" aria-hidden="true">
      <div className="vhs-label inline-block text-sm opacity-50">TUNING…</div>
      <div className="panel-xbox p-5">
        <div className="h-10 rounded bg-white/5 animate-pulse" />
      </div>
    </section>
  );
}

/* ============================================
   Review Card (inline)
   ============================================ */

/* ReviewCard moved to components/profile/ProfileReviewsGrid.tsx so the
   Reviews tab can switch views (detailed/posters/compact) client-side. */
