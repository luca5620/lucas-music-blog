/**
 * Public User Profile Page — "Steam on a CRT"
 *
 * Every profile is a little owned space: the user picks a THEME
 * (a preset — the `theme-*` classes in globals.css re-skin accents,
 * heading fonts, and panel styling inside the wrapper div) and
 * arranges SHOWCASES (ordered blocks: ratings, recent reviews,
 * featured review, song of the day, stats.fm listening…).
 *
 * Showcases overhaul round 2 (Luca 2026-10-24, "a mix of B and C"):
 * the big pieces (the featured record, Most loved songs, Now showing)
 * sit on the page with no box and a hairline heading; the small live
 * ones (Ratings, Song of the day, On rotation, All-time listening, and
 * Taste match for visitors) are tinted widgets in one two-column grid.
 * Empty showcases are hidden from visitors.
 *
 * Everything renders on the server; tabs are plain links (?tab=)
 * so switching needs no client JS.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getProfileByUsername,
  getProfileReviews,
  getProfileStats,
  isFollowing,
} from "@/lib/db/profiles";
import { getListsByUsername } from "@/lib/db/lists";
import { getUser, getProfile } from "@/lib/auth";
import { getTasteMatch, getMostLovedSongs } from "@/lib/db/showcases";
import { getRatingHex, getRatingColor, formatRating } from "@/lib/rating";
import FollowButton from "./FollowButton";
import BlockButton from "@/components/moderation/BlockButton";
import ReportButton from "@/components/moderation/ReportButton";
import MonthShareButton from "@/components/share/MonthShareButton";
import { isBlocked } from "@/lib/db/moderation";
import ProfileSongPlayer from "./ProfileSongPlayer";
import RoleBadge from "@/components/ui/RoleBadge";
import { getSupporterSince } from "@/lib/db/supporters";
import ListeningShowcase from "@/components/profile/ListeningShowcase";
import SongOfDayShowcase from "@/components/profile/SongOfDayShowcase";
import SavedShelf from "@/components/profile/SavedShelf";
import { getSavedReleases } from "@/lib/db/releases";
import {
  WidgetGrid,
  RatingsWidget,
  TasteMatchWidget,
  AddShowcaseHint,
} from "@/components/profile/ShowcaseWidgets";
import MostLovedSongs from "@/components/profile/MostLovedSongs";
import ReviewSleeve from "@/components/reviews/ReviewSleeve";
import ProfileReviewsGrid from "@/components/profile/ProfileReviewsGrid";
import ThemeBackdrop from "@/components/profile/ThemeBackdrop";
import ThemeLiquidSync from "@/components/profile/ThemeLiquidSync";
import ProfileStats from "@/components/profile/ProfileStats";
import TheLog from "@/components/profile/TheLog";
import BackLink from "@/components/ui/BackLink";
import { THEME_SPECS, VALID_THEMES } from "@/lib/profile-theme";
import PlatformIcon from "@/components/profile/PlatformIcons";
import { resolveVisibleLinks } from "@/lib/social-links";
import { getUserPosts } from "@/lib/db/posts";
import type { StreakIcon } from "@/components/profile/StreakIndicator";
import ListCard from "@/components/lists/ListCard";
import PlaylistEmbed from "@/components/playlists/PlaylistEmbed";
import type { Metadata } from "next";
// LANGUAGES: server page → getTranslations("profile"); getLocale drives
// date formatting so "Member since" reads in the visitor's language.
import { getLocale, getTranslations } from "next-intl/server";
import type {
  ProfileTheme,
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

/** The profile tabs. Anything else falls back to "reviews". */
type ProfileTab = "reviews" | "lists" | "posts" | "saved";

function resolveTab(raw: string | undefined): ProfileTab {
  return raw === "lists" || raw === "posts" || raw === "saved" ? raw : "reviews";
}

/* --- Theme → accent hex now lives in lib/profile-theme.ts (one
       table with the labels and liquid trios, shared with the hover
       card and the settings picker). Client components (FollowButton,
       the histogram) take a hex prop, so we resolve it once here. --- */

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

/** Default showcase arrangement for rows created before migration 006.
    "favorites" removed 2026-08-26 (Luca) — dropping it from this list
    and VALID_SHOWCASES is what hides the block on every profile,
    including rows that still carry it in their showcases array. */
const DEFAULT_SHOWCASES: ShowcaseType[] = ["stats", "recent_reviews"];

/* "badges" (the CREDENTIALS block) left this list 2026-09-02 (Luca):
   badges now live under the username on every profile, so the block
   is gone the same way "favorites" went — rows still carrying it just
   don't render it. */
/* "lists" (Mixtapes) and "anticipated" (Waiting On) left 2026-10-24
   (Luca, showcases overhaul round 2) — only 2 and 1 profiles used
   them. Same trick as above: rows still carrying them just don't
   render them, and Settings drops them on the next save. */
/* "loved_songs" joined 2026-10-25 (Luca: "i dont even want it on my
   profile, why is it permanently baked in?"). Most loved songs used to
   be added to every profile automatically; now it's a showcase like
   the others: off until you switch it on in Settings, and it sits
   wherever you put it in the order. */
const VALID_SHOWCASES: ShowcaseType[] = [
  "stats",
  "recent_reviews",
  "featured_review",
  "listening",
  "listening_stats",
  "sotd",
  "loved_songs",
];

/** The small "live" showcases that render as widgets in ONE grid
    (ShowcaseWidgets.tsx). The grid sits where the first of them is in
    the member's order; inside it they keep their relative order. */
const WIDGET_SHOWCASES: ShowcaseType[] = ["stats", "sotd", "listening", "listening_stats"];

/** One block of the showcase column: a big showcase or the widget grid. */
type ShowcaseBlock = ShowcaseType | "widgets";

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

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const { tab: rawTab } = await searchParams;
  const activeTab = resolveTab(rawTab);
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const tr = await getTranslations("reviews.page");
  const tSupport = await getTranslations("support");
  const locale = await getLocale();

  // --- Resolve theme + showcases defensively. Until migration 006
  //     runs, these columns don't exist and come back undefined. ---
  const theme: ProfileTheme = VALID_THEMES.includes(profile.theme)
    ? profile.theme
    : "crt-blue";
  const accentColor = THEME_SPECS[theme].accent;
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

  // Featured review works even with nothing pinned: fall back to the
  // user's highest-rated published review so enabling the showcase
  // always shows SOMETHING (a pin in Settings overrides the pick).
  const needsFeatured = showcases.includes("featured_review");
  // Lists are only the Lists tab now (the Mixtapes showcase is gone).
  const needsLists = activeTab === "lists";

  // ONE batch for everything that only needs the profile row. This
  // page used to do these across four sequential awaits — on a phone
  // over cell data every extra round trip is felt, and profiles were
  // the slowest pages on the site because of it.
  const [
    currentUser,
    stats,
    reviews,
    profilePosts,
    featuredRes,
    profileLists,
    supporterSince,
    savedReleases,
  ] = await Promise.all([
    getUser(),
    getProfileStats(profile.id),
    getProfileReviews(profile.id),
    // Posts tab data — only fetched when that tab is open.
    activeTab === "posts" ? getUserPosts(profile.id) : Promise.resolve([]),
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
    // "Supporter since …" under the handle (migration 061). Null for
    // everyone who never supported, and before 061 runs.
    getSupporterSince(profile.id),
    // Saved tab ("Save for later" = release follows) — only when open.
    activeTab === "saved" ? getSavedReleases(profile.id) : Promise.resolve([]),
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
  // Viewer-relative bits need currentUser, so they get a second batch
  // — still one round trip for all of them together. Taste match (and
  // the visitor's own avatar for it) only for a signed-in VISITOR;
  // Most loved songs rides along (only when it's switched on) because
  // it needs the reviews list.
  const viewerId = currentUser && !isOwnProfile ? currentUser.id : null;
  const [userFollows, viewerHasBlocked, tasteMatch, viewerProfile, lovedSongs] =
    await Promise.all([
      viewerId ? isFollowing(viewerId, profile.id) : false,
      viewerId ? isBlocked(viewerId, profile.id) : false,
      viewerId ? getTasteMatch(viewerId, reviews as Review[]) : null,
      viewerId ? getProfile() : null,
      showcases.includes("loved_songs")
        ? getMostLovedSongs(profile.id, reviews as Review[])
        : [],
    ]);

  const featuredReview = (featuredRes.data as Review | null) ?? null;

  // --- The showcase column, block by block (see ShowcaseBlock). ---
  const widgetTypes = showcases.filter((s) => WIDGET_SHOWCASES.includes(s));
  const blocks: ShowcaseBlock[] = [];
  for (const s of showcases) {
    if (!WIDGET_SHOWCASES.includes(s)) blocks.push(s);
    else if (!blocks.includes("widgets")) blocks.push("widgets");
  }
  // Taste match lives in the widget grid — a profile with no widget
  // showcases still gets the grid for it, right under the featured
  // record (or first, when there's no featured record).
  if (tasteMatch && !blocks.includes("widgets")) {
    blocks.splice(blocks.indexOf("featured_review") + 1, 0, "widgets");
  }

  const displayName = profile.display_name ?? profile.username;
  const memberSince = new Date(profile.created_at).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
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
      // .crt-screen's padding (1rem on phones, 2rem/1.75rem on sm+,
      // 3.25rem/2rem at 1440px+ — missing that step left a 20px
      // unthemed strip down both sides on big monitors, Luca 2026-09-25).
      // Written as 90rem, NOT 1440px: Tailwind v4 cannot order a px
      // breakpoint against its rem ones, emitted it BEFORE sm:, and
      // sm:-mx-8 silently won. The matching 1.25rem padding keeps the
      // CONTENT where it always sat; only the background reaches out.
      // -m-8 everywhere overshot by 1rem per side on phones — the page
      // went wider than the screen, so the app wobbled sideways and
      // the banner hung past the borders.
      className={`theme-${theme} relative isolate space-y-6 -mx-4 -mt-4 -mb-8 sm:-mx-8 sm:-mt-7 min-[90rem]:-mx-[3.25rem] min-[90rem]:px-[1.25rem] min-[90rem]:-mt-8`}
      style={pageBg ? { background: pageBg } : undefined}
    >
      {/* Animated console-dashboard atmosphere for this theme */}
      <ThemeBackdrop theme={theme} />
      {/* Recolor the site-wide liquid (room glow + canvas wash) to
          this profile's theme while the page is open */}
      <ThemeLiquidSync theme={theme} />

      {/* ← Back, like every other detail page (Luca 2026-10-24: opening a
          profile from a review or the home feed had no way back). Pops
          real history. onlyAfterRedirect (2026-10-25): hidden when the
          profile was opened from the tab bar / top-right menu or loaded
          directly, so it only shows after an obvious jump from a page. */}
      <BackLink
        onlyAfterRedirect
        fallback="/"
        label={tc("back")}
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1 pt-4 sm:pt-6"
      />

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
      <div className="px-4 sm:px-8 -mt-28 sm:-mt-20 relative z-10 profile-header-wrap">
        {/* Two columns on web (Luca 2026-09-12): everything as before
            on the left (header row · numbers · bio · links), The Log
            to the right of it all. Phones: one column, The Log last. */}
        <div className="profile-header-main space-y-6">
        {/* Header (Luca 2026-09-12). Phones: the avatar on the left with
            the Customize / Follow button top-right just under the
            banner, then the name block. Web: one row — avatar · name
            block · the button at the far right. */}
        <div className="profile-head">
          <div className="profile-head-top">
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

          {/* Follow / Edit button */}
          <div className="profile-head-action shrink-0">
            {isOwnProfile ? (
              <span className="profile-head-own inline-flex items-center gap-2">
                <Link
                  href="/settings/profile"
                  className="btn-y2k btn-y2k-outline"
                  style={{ borderColor: accentColor, color: accentColor }}
                >
                  {t("customize")}
                </Link>
                {/* The My month share card (Luca 2026-10-24) */}
                <MonthShareButton
                  userId={profile.id}
                  handle={profile.username}
                  role={profile.role}
                  avatarUrl={profile.avatar_url}
                  accentColor={accentColor}
                />
              </span>
            ) : currentUser ? (
              <span className="profile-head-pair inline-flex items-center gap-2">
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
                {/* Report the PROFILE itself (avatar, banner, name, bio).
                    Before this, a profile only reached /admin/reports when
                    someone blocked it — so a bad profile picture had no
                    direct flag, and staff's Remove avatar / Remove banner
                    buttons had nothing to act on. */}
                <ReportButton targetType="profile" targetId={profile.id} />
              </span>
            ) : (
              <Link href="/login" className="profile-head-login btn-y2k btn-y2k-outline">
                {t("loginToFollow")}
              </Link>
            )}
          </div>
          </div>

          {/* Name + flair */}
          <div className="profile-head-name min-w-0 space-y-1.5">
            <h1 className="crt-title text-3xl sm:text-5xl flex items-center gap-2 min-w-0">
              <span className="truncate">{displayName}</span>
              <RoleBadge role={profile.role} size="md" />
            </h1>
            <p className="font-[family-name:var(--font-vt323)] text-lg text-text-secondary">
              @{profile.username}
              {/* Silver, like the checkmark. Plain text, no link and no
                  price: this line shows in the app too (Apple 3.1.3 —
                  recognition is fine, a route to paying isn't). */}
              {supporterSince && (
                <span className="text-[#e2e8f0]/80">
                  {" · "}
                  {tSupport("since", {
                    since: new Date(supporterSince).getUTCFullYear().toString(),
                  })}
                </span>
              )}
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

        </div>

        {/* THE FOUR NUMBERS — followers · following · reviews · likes,
            left-justified under the header on every screen (Luca
            2026-09-12). Phones: right under the name block. Web: on the
            page's left edge, in line with the bio and the links. */}
        <ProfileStats
          stats={stats}
          accentColor={accentColor}
          isOwnProfile={isOwnProfile}
          hidden={profile.hidden_badges ?? null}
        />

        {/* Bio */}
        {profile.bio && (
          <p className="text-text-primary text-sm sm:text-base leading-relaxed max-w-2xl">
            {profile.bio}
          </p>
        )}

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
                {t("hiddenFromVisitors")}
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
                title={t("playlistTitle", { name: profile.display_name || profile.username })}
                label={t("featuredPlaylist")}
              />
            </div>
          )}
        </div>

        {/* Favorite genres removed 2026-08-22 (Luca) — the editor and
            this pill row both; old favorite_genres rows just sit
            untouched in the DB. */}
        </div>

        {/* THE LOG — the month punch card: right of everything on web,
            under everything on phones (Luca 2026-09-12). */}
        <div className="profile-header-log">
          <TheLog
            reviews={reviews as Review[]}
            locale={locale}
            accentColor={accentColor}
          />
        </div>
      </div>

      {/* ========== SHOWCASES — rendered in the user's chosen order ==========
          (blocks built above: big showcases, the widget grid, Most loved) */}
      <div className="px-4 sm:px-8 space-y-8">
        {blocks.map((block) => {
          switch (block) {
            case "widgets":
              return (
                <WidgetGrid key={block}>
                  {/* Taste match leads the grid — it's the one tile that's
                      about YOU, the visitor. */}
                  {tasteMatch && (
                    <TasteMatchWidget
                      match={tasteMatch}
                      ownerName={displayName}
                      ownerAvatar={profile.avatar_url}
                      viewerAvatar={viewerProfile?.avatar_url ?? null}
                      viewerInitial={(viewerProfile?.display_name || viewerProfile?.username || "?")[0].toUpperCase()}
                    />
                  )}
                  {widgetTypes.map((type) => {
                    switch (type) {
                      case "stats":
                        // RATINGS — the average in a badge + one row of dots.
                        return (
                          <RatingsWidget
                            key={type}
                            ratings={(reviews as Review[]).map((r) => Number(r.rating))}
                          />
                        );
                      case "sotd":
                        // SONG OF THE DAY — daily pick + streak (migrations
                        // 009 + 010). Suspense: it streams in after the page.
                        return (
                          <Suspense key={type} fallback={<WidgetSkeleton />}>
                            <SongOfDayShowcase
                              userId={profile.id}
                              isOwner={isOwnProfile}
                              streakIcon={(profile.streak_icon ?? "flame") as StreakIcon}
                            />
                          </Suspense>
                        );
                      case "listening":
                      case "listening_stats":
                        // ON ROTATION / ALL-TIME LISTENING (stats.fm). These
                        // await an EXTERNAL API — they must stream in after
                        // the page, never hold the page back.
                        return (
                          <Suspense key={type} fallback={<WidgetSkeleton wide />}>
                            <ListeningShowcase
                              mode={type === "listening" ? "track" : "stats"}
                              statsfmUrl={profile.statsfm_url}
                              isOwner={isOwnProfile}
                            />
                          </Suspense>
                        );
                      default:
                        return null;
                    }
                  })}
                </WidgetGrid>
              );

            case "loved_songs":
              return <MostLovedSongs key={block} songs={lovedSongs} />;

            case "recent_reviews": {
              // The featured record isn't repeated here ("grapes shows up
              // three times", 2026-10-24).
              const recent = (reviews as Review[])
                .filter((r) => r.id !== featuredReview?.id)
                .slice(0, 8);
              // Visitors never see an empty Now showing; the owner gets the
              // one button that fills it.
              if (recent.length === 0 && !isOwnProfile) return null;
              return (
                <section key={block} className="space-y-3">
                  <h2 className="sc-label">
                    <span>{t("nowShowing")}</span>
                  </h2>
                  {recent.length === 0 ? (
                    <EmptyState
                      text={t("noSignalOwnReviews")}
                      cta={{ href: "/start", label: t("ctaRate") }}
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
                                alt={t("coverAlt", { title: review.title })}
                              />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center text-4xl">
                                💿
                              </span>
                            )}
                            {/* the site's rating badge, never a bare number */}
                            <span className={`rating-badge sc-poster-badge ${getRatingColor(review.rating)}`}>
                              {formatRating(review.rating)}
                            </span>
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
              // Mockup B: the review page's record-out-of-the-sleeve, with
              // the score on the record's label, straight on the page.
              return (
                <section key={block} className="space-y-3">
                  <h2 className="sc-label">
                    <span>{t("featurePresentation")}</span>
                  </h2>
                  <Link href={`/reviews/${featuredReview.slug}`} className="sc-feature group">
                    <ReviewSleeve
                      cover={featuredReview.cover_image}
                      coverAlt={t("coverAlt", { title: featuredReview.title })}
                      rating={featuredReview.rating}
                      outOfLabel={tr("outOf")}
                    />
                    <span className="sc-feature-text">
                      <span className="sc-feature-title group-hover:text-accent-primary transition-colors">
                        {featuredReview.title}
                      </span>
                      <span className="sc-widget-sub block">{featuredReview.artist}</span>
                      {featuredReview.snippet && (
                        <span className="sc-feature-quote">“{featuredReview.snippet}”</span>
                      )}
                    </span>
                  </Link>
                </section>
              );
            }

            default:
              return null;
          }
        })}

        {/* The owner's way to add more — only while some showcase is
            still switched off. Visitors never see it. */}
        {isOwnProfile && showcases.length < VALID_SHOWCASES.length && <AddShowcaseHint />}
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
              { key: "reviews", label: t("tabs.reviews") },
              { key: "lists", label: t("tabs.lists") },
              { key: "posts", label: t("tabs.posts") },
              { key: "saved", label: t("tabs.saved") },
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
            /* Your OWN empty tab talks to you, with the way to fill it
               (2026-10-05) — the visitor line read like someone else's
               dead profile to a brand-new member. */
            <EmptyState
              text={isOwnProfile ? t("noSignalOwnReviews") : t("noSignalReviews")}
              cta={isOwnProfile ? { href: "/start", label: t("ctaRate") } : undefined}
            />
          ) : (
            /* View-switchable (detailed/posters/compact) — the choice
               persists and is shared with the reviews index. */
            <ProfileReviewsGrid reviews={reviews as Review[]} />
          ))}

        {/* ----- Lists tab ----- */}
        {activeTab === "lists" &&
          (profileLists.length === 0 ? (
            <EmptyState
              text={isOwnProfile ? t("noSignalOwnLists") : t("noSignalListsTab")}
              cta={isOwnProfile ? { href: "/lists/new", label: t("ctaList") } : undefined}
            />
          ) : (
            // Open rows, no cards (less-boxy pass, Luca 2026-10-27).
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              {profileLists.map((list) => (
                <ListCard key={list.id} list={list} variant="open" />
              ))}
            </div>
          ))}

        {/* ----- Posts tab ----- */}
        {activeTab === "posts" &&
          (profilePosts.length === 0 ? (
            <EmptyState
              text={isOwnProfile ? t("noSignalOwnPosts") : t("noSignalPosts")}
              cta={isOwnProfile ? { href: "/posts/new", label: t("ctaPost") } : undefined}
            />
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
                    {new Date(p.created_at).toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </Link>
              ))}
            </div>
          ))}

        {/* ----- Saved tab ("Save for later", Luca 2026-10-25) -----
            Records saved and not rated yet; upcoming ones show their
            drop date, and a push goes out the moment they drop (062). */}
        {activeTab === "saved" &&
          (savedReleases.length === 0 ? (
            <EmptyState
              text={isOwnProfile ? t("noSignalOwnSaved") : t("noSignalSaved")}
              cta={isOwnProfile ? { href: "/releases", label: t("ctaSaved") } : undefined}
            />
          ) : (
            <SavedShelf
              items={savedReleases}
              locale={locale}
              labels={{
                drops: (date) => t("savedDrops", { date }),
                outToday: t("savedOutToday"),
              }}
            />
          ))}
      </div>

      {/* ========== MEMBER SINCE ========== */}
      <div className="px-4 sm:px-8 pb-8">
        <p className="font-[family-name:var(--font-vt323)] text-sm text-text-muted text-center">
          {t("memberSince", { date: memberSince })}
        </p>
      </div>
    </div>
  );
}

/* ============================================
   Empty state — CRT static box
   ============================================ */

/**
 * The NO SIGNAL box. On your OWN profile it also carries the one
 * button that fills it (2026-10-05: a brand-new member's profile was a
 * wall of text-only boxes with nothing to tap). Visitors get the plain
 * box — you can't fill someone else's shelf. "Rate a record" goes to
 * /start, the first-rating screen, which forwards anyone past their
 * first three to the normal flow.
 */
function EmptyState({
  text,
  cta,
}: {
  text: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="panel-xbox p-8 text-center space-y-4">
      <p className="osd-text text-sm opacity-70">{text}</p>
      {cta && (
        <Link href={cta.href} className="btn-y2k btn-y2k-outline inline-flex text-xs">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

/** Streaming placeholder for the slow (external-data) widgets — a
    plain tile the size of the real one, so the grid doesn't jump. */
function WidgetSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`sc-widget sc-widget-skeleton${wide ? " is-wide" : " is-half"}`} aria-hidden="true">
      <div className="h-10 rounded bg-white/5 animate-pulse" />
    </div>
  );
}

/* ============================================
   Review Card (inline)
   ============================================ */

/* ReviewCard moved to components/profile/ProfileReviewsGrid.tsx so the
   Reviews tab can switch views (detailed/posters/compact) client-side. */
