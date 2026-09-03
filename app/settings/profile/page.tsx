"use client";

/**
 * Profile Settings — the customization studio.
 *
 * Steam-style: you don't just edit text fields, you SKIN your page.
 *  - Identity: name, tagline, pronouns, location, bio
 *  - Appearance: theme presets (live preview — each preset swaps
 *    accents, fonts, AND panel styling) + real avatar/banner
 *    uploads to Supabase Storage (no more URL pasting)
 *  - Showcases: choose WHICH blocks appear on your profile and in
 *    what order (stats, recent reviews, featured review, badges,
 *    lists, anticipated…)
 *  - Featured review, profile song, streaming links, genres
 *
 * Saves happen via the Supabase browser client updating your own
 * profiles row — RLS guarantees you can only ever touch your own.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parsePlaylistUrl, playlistUrl } from "@/lib/playlist";
import {
  PLATFORMS,
  getPlatform,
  isPlatformKey,
  isValidPlatformUrl,
  type PlatformKey,
} from "@/lib/social-links";
import PlatformIcon from "@/components/profile/PlatformIcons";
import {
  COMPUTED_BADGE_INFO,
  COMPUTED_BADGE_KEYS,
  eventBadge,
  hiddenBadgeSet,
} from "@/lib/badges";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import ChangePasswordSection from "@/components/settings/ChangePasswordSection";
import SettingsSection from "@/components/settings/SettingsSection";
import LowDetailToggle from "@/components/ui/LowDetailToggle";
import LanguagePicker from "@/components/ui/LanguagePicker";
import { useTranslations } from "next-intl";
import CatalogSearch, {
  type CatalogPick,
} from "@/components/catalog/CatalogSearch";
import StreakIndicator, {
  type StreakIcon as StreakIconChoice,
} from "@/components/profile/StreakIndicator";
import type {
  Profile,
  ProfileTheme,
  Review,
  ShowcaseType,
} from "@/lib/types/database";

/* Theme presets. Ids and hexes must match the
   theme-* classes in globals.css AND the DB constraint from migration
   006. The swatch shows the accent; the theme-* class does the real
   work (accents, heading font, panel styling). */
const THEMES: { id: ProfileTheme; label: string; hex: string; desc: string }[] = [
  { id: "crt-blue", label: "Broadcast", hex: "#1e90ff", desc: "The standard Peak Music Reviews look" },
  { id: "ps2", label: "PS2 · Nebula", hex: "#8ba7e8", desc: "The boot-screen galaxy — indigo clouds and silver dust" },
  { id: "ps3", label: "PS3 · XMB", hex: "#7ec9e8", desc: "Black void, silver-blue shimmer, thin airy type" },
  { id: "ps4", label: "PS4", hex: "#4a90d9", desc: "Deep PlayStation blue, clean and modern" },
  { id: "xbox-og", label: "Xbox OG", hex: "#5dc21e", desc: "Acid green on black metal, industrial type" },
  { id: "xbox-360", label: "Xbox 360", hex: "#92c83e", desc: "Blade-dashboard green, glossy and friendly" },
  { id: "wii", label: "Wii", hex: "#35b7d8", desc: "White channel cards, rounded and cheerful" },
  { id: "limewire", label: "LimeWire", hex: "#32cd32", desc: "Where internet music began — beveled freeware beige" },
  { id: "bleach", label: "Soul Reaper", hex: "#e3342f", desc: "Manga ink — stark black & white with a blood-red slash" },
  { id: "daft-punk", label: "Robot Rock", hex: "#f0b93c", desc: "Helmet chrome and Discovery gold, neon horizon" },
];

/* Every showcase block a profile can display. Four Favorites was
   removed from customization entirely (Luca 2026-08-26) — the load
   filter below strips it from older rows on next save, and the
   profile page no longer renders it. "Credentials" (badges) went the
   same way 2026-09-02: badges now sit under the username on every
   profile, nothing to arrange. */
const SHOWCASE_OPTIONS: { id: ShowcaseType; label: string; hint: string }[] = [
  { id: "stats", label: "Taste Readout", hint: "Review count, average, rating histogram" },
  { id: "recent_reviews", label: "Now Showing", hint: "Your latest 8 reviews as a poster wall" },
  { id: "featured_review", label: "Feature Presentation", hint: "One pinned review, front and center" },
  { id: "lists", label: "Mixtapes", hint: "Your newest public lists" },
  { id: "anticipated", label: "Waiting On", hint: "Releases you follow, unreleased included" },
  { id: "listening", label: "On Rotation", hint: "What you're playing right now / last played (needs your stats.fm link below)" },
  { id: "listening_stats", label: "All-Time Listening", hint: "Lifetime minutes + total streams (needs your stats.fm link below)" },
  { id: "sotd", label: "Song of the Day", hint: "Daily pick — keep it up every day to grow your streak flame" },
];

/** Uploads are capped client-side; the buckets are public-read.
    Banners get a bigger allowance — they're wide, detailed images
    and 2MB forced ugly compression. 6MB is still a fast download. */
const MAX_UPLOAD_BYTES: Record<"avatars" | "banners", number> = {
  avatars: 2 * 1024 * 1024, // 2MB
  banners: 6 * 1024 * 1024, // 6MB
};

export default function ProfileSettingsPage() {
  // LANGUAGES: section titles/hints for the per-device sections.
  const tSettings = useTranslations("settings");
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // --- Identity ---
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  // What the row currently holds — so we only send username when it
  // actually changed, and can restore the field after a failed save.
  const [savedUsername, setSavedUsername] = useState("");
  // Migration 028 gate + cooldown clock. Before the columns exist the
  // field stays read-only-permanent like it always was; after, it's
  // editable once every 14 days (trigger-enforced server-side).
  const [supportsNameLimits, setSupportsNameLimits] = useState(false);
  const [usernameChangedAt, setUsernameChangedAt] = useState<string | null>(
    null
  );
  const [tagline, setTagline] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");

  // --- Appearance ---
  const [theme, setTheme] = useState<ProfileTheme>("crt-blue");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [streakIcon, setStreakIcon] = useState<StreakIconChoice>("flame");

  // --- Showcases (ordered list of ENABLED blocks) ---
  const [showcases, setShowcases] = useState<ShowcaseType[]>([
    "stats", "recent_reviews",
  ]);
  const [featuredReviewId, setFeaturedReviewId] = useState<string>("");
  const [myReviews, setMyReviews] = useState<Pick<Review, "id" | "title" | "artist" | "rating">[]>([]);

  // --- Song / links / genres ---
  const [profileSongUrl, setProfileSongUrl] = useState("");
  const [profileSongTitle, setProfileSongTitle] = useState("");
  // Catalog pick in progress for the profile song (release chosen,
  // track not yet chosen). Not persisted — only title/url are saved.
  const [songRelease, setSongRelease] = useState<CatalogPick | null>(null);
  // Connected platforms (lib/social-links.ts is the registry): one
  // pasted link per platform key, plus the ORDERED keys shown on the
  // profile (migration 039's visible_links). supportsLinks039 gates
  // the five new platforms + the show/order controls on the columns
  // existing — same reason as every other supportsX flag here.
  const [links, setLinks] = useState<Record<PlatformKey, string>>(
    () =>
      Object.fromEntries(PLATFORMS.map((pl) => [pl.key, ""])) as Record<
        PlatformKey,
        string
      >
  );
  const [visibleLinks, setVisibleLinks] = useState<PlatformKey[]>([]);
  const [supportsLinks039, setSupportsLinks039] = useState(false);
  // "Don't show these on my profile" — links stay saved (and keep
  // feeding the stats.fm showcases), visitors just don't see the icon
  // row. supportsHideLinks gates the checkbox on migration 027 having
  // run: before the column exists, saving it would fail the whole
  // update, so the option simply doesn't appear yet.
  const [hideStreamingLinks, setHideStreamingLinks] = useState(false);
  const [supportsHideLinks, setSupportsHideLinks] = useState(false);
  // Featured Spotify playlist (migration 035) — the field holds the
  // pasted LINK for editing; only the parsed 22-char id is ever saved.
  // supportsFeaturedPlaylist gates it on the column existing, same
  // reason as supportsHideLinks above.
  const [featuredPlaylistLink, setFeaturedPlaylistLink] = useState("");
  const [supportsFeaturedPlaylist, setSupportsFeaturedPlaylist] = useState(false);
  // Preview player on release pages (migration 036): Spotify by
  // default, Apple Music as the one alternative — never both on a
  // page (Luca 2026-09-02). Gated on the column existing, as above.
  const [preferredPlayer, setPreferredPlayer] = useState<"spotify" | "apple">("spotify");
  const [supportsPreferredPlayer, setSupportsPreferredPlayer] = useState(false);
  // Hidden badges (migration 040, Luca 2026-09-03): the keys the
  // member does NOT want under their username — "reviews" / "likes" /
  // "tenure" for the computed trophies, or an awarded event badge's
  // key. Nothing is deleted; the owner still sees hidden ones dimmed.
  // myEventBadges = this member's profile_badges rows, so the list
  // offers a toggle for every badge they actually hold. Gated on the
  // column existing, like every other supportsX flag here.
  const [hiddenBadges, setHiddenBadges] = useState<string[]>([]);
  const [supportsHiddenBadges, setSupportsHiddenBadges] = useState(false);
  const [myEventBadges, setMyEventBadges] = useState<
    { badge_key: string; note: string | null }[]
  >([]);

  const themeHex = THEMES.find((t) => t.id === theme)?.hex ?? "#1e90ff";

  // Username cooldown (migration 028): 14 days from the last change.
  const usernameNextAllowed = usernameChangedAt
    ? new Date(
        new Date(usernameChangedAt).getTime() + 14 * 24 * 60 * 60 * 1000
      )
    : null;
  const usernameLocked =
    !!usernameNextAllowed && usernameNextAllowed > new Date();

  // Load the current profile once.
  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const [{ data: profile }, { data: reviews }, { data: eventBadges }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase
            .from("reviews")
            .select("id, title, artist, rating")
            .eq("user_id", user.id)
            .eq("is_published", true)
            .order("created_at", { ascending: false })
            .limit(50),
          // Awarded event badges (migration 039) — errors (table not
          // there yet) just read as no badges.
          supabase
            .from("profile_badges")
            .select("badge_key, note")
            .eq("user_id", user.id)
            .order("awarded_at", { ascending: true }),
        ]);

      if (profile) {
        const p = profile as Profile;
        setDisplayName(p.display_name ?? "");
        setUsername(p.username ?? "");
        setSavedUsername(p.username ?? "");
        setSupportsNameLimits("username_changed_at" in p);
        setUsernameChangedAt(p.username_changed_at ?? null);
        setTagline(p.tagline ?? "");
        setPronouns(p.pronouns ?? "");
        setLocation(p.location ?? "");
        setBio(p.bio ?? "");
        setTheme(
          THEMES.some((t) => t.id === p.theme) ? p.theme : "crt-blue"
        );
        setAvatarUrl(p.avatar_url ?? "");
        setBannerUrl(p.banner_url ?? "");
        setStreakIcon(p.streak_icon ?? "flame");
        setShowcases(
          Array.isArray(p.showcases) && p.showcases.length > 0
            ? p.showcases.filter((s): s is ShowcaseType =>
                SHOWCASE_OPTIONS.some((o) => o.id === s)
              )
            : ["stats", "recent_reviews"]
        );
        setFeaturedReviewId(p.featured_review_id ?? "");
        setProfileSongUrl(p.profile_song_url ?? "");
        setProfileSongTitle(p.profile_song_title ?? "");
        // Every platform column into one map; unknown (pre-039)
        // columns simply read as "".
        const loadedLinks = {} as Record<PlatformKey, string>;
        for (const pl of PLATFORMS) {
          const v = (p as unknown as Record<string, unknown>)[pl.column];
          loadedLinks[pl.key] = typeof v === "string" ? v : "";
        }
        setLinks(loadedLinks);
        setSupportsLinks039("visible_links" in p);
        setVisibleLinks(
          Array.isArray(p.visible_links)
            ? p.visible_links.filter(isPlatformKey)
            : // Legacy rows (null): everything saved shows, default order
              PLATFORMS.filter((pl) => loadedLinks[pl.key]).map((pl) => pl.key)
        );
        setHideStreamingLinks(p.hide_streaming_links ?? false);
        setSupportsHideLinks("hide_streaming_links" in p);
        setFeaturedPlaylistLink(
          p.featured_playlist_id ? playlistUrl(p.featured_playlist_id) : ""
        );
        setSupportsFeaturedPlaylist("featured_playlist_id" in p);
        setPreferredPlayer(p.preferred_player === "apple" ? "apple" : "spotify");
        setSupportsPreferredPlayer("preferred_player" in p);
        setSupportsHiddenBadges("hidden_badges" in p);
        setHiddenBadges([...hiddenBadgeSet(p.hidden_badges)]);
      }

      setMyEventBadges(
        (Array.isArray(eventBadges) ? eventBadges : []) as {
          badge_key: string;
          note: string | null;
        }[]
      );

      setMyReviews(
        (reviews ?? []) as Pick<Review, "id" | "title" | "artist" | "rating">[]
      );
      setLoading(false);
    }

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  /* --- Connected-platform helpers --- */

  /** Typing a link shows it by default; clearing it hides it. */
  function setLink(key: PlatformKey, value: string) {
    setLinks((prev) => ({ ...prev, [key]: value }));
    setVisibleLinks((prev) => {
      const has = prev.includes(key);
      if (value.trim() && !has) return [...prev, key];
      if (!value.trim() && has) return prev.filter((k) => k !== key);
      return prev;
    });
    setSaved(false);
  }

  function toggleLink(key: PlatformKey) {
    setVisibleLinks((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
    setSaved(false);
  }

  /** Move a shown platform left (-1) or right (+1) in the row. */
  function moveLink(key: PlatformKey, dir: -1 | 1) {
    setVisibleLinks((prev) => {
      const idx = prev.indexOf(key);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
    setSaved(false);
  }

  /* --- Showcase helpers: toggle on/off + reorder with arrows --- */

  function toggleShowcase(id: ShowcaseType) {
    setShowcases((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setSaved(false);
  }

  function moveShowcase(id: ShowcaseType, dir: -1 | 1) {
    setShowcases((prev) => {
      const idx = prev.indexOf(id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setSaved(false);
  }

  /* --- Storage uploads. Path MUST start with the user's id — the
         bucket policy only allows writes inside your own folder. --- */

  async function handleUpload(
    file: File,
    bucket: "avatars" | "banners",
    onDone: (publicUrl: string) => void,
    setBusy: (b: boolean) => void
  ) {
    if (!userId) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES[bucket]) {
      setError(
        `Image is too big — keep it under ${bucket === "banners" ? 6 : 2}MB.`
      );
      return;
    }

    setBusy(true);
    try {
      // Timestamped filename: re-uploads never fight browser caches.
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${userId}/${bucket === "avatars" ? "avatar" : "banner"}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) {
        setError(`Upload failed: ${upErr.message}`);
        return;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onDone(data.publicUrl);
    } finally {
      setBusy(false);
    }
  }

  /* --- Save everything --- */

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    // Platform links must come from their actual services — they
    // render as clickable links on your PUBLIC profile, so a link to
    // anywhere else is rejected, not saved (the database enforces the
    // same allow-list). The row shows the red hint before you get here.
    for (const pl of PLATFORMS) {
      const v = links[pl.key].trim();
      if (v && !isValidPlatformUrl(pl, v)) {
        setError(`That ${pl.label} link isn't a ${pl.label} URL — paste one from ${pl.hosts[0].replace(".*", ".com")}.`);
        setSaving(false);
        return;
      }
    }

    // --- Username (migration 028): editable once every 14 days.
    //     Only SENT when it actually changed — the DB trigger is the
    //     real enforcer; these checks just fail friendlier + faster.
    const nextUsername = username.trim().toLowerCase();
    const usernameChanged =
      supportsNameLimits && nextUsername !== savedUsername;
    if (usernameChanged) {
      if (!/^[a-z0-9_]{3,20}$/.test(nextUsername)) {
        setError(
          "Usernames are 3–20 characters: lowercase letters, numbers, underscores."
        );
        setSaving(false);
        return;
      }
      if (usernameNextAllowed && usernameNextAllowed > new Date()) {
        setError(
          `You can change your username again on ${usernameNextAllowed.toLocaleDateString()}.`
        );
        setSaving(false);
        return;
      }
    }

    const updates: Partial<Profile> = {
      ...(usernameChanged ? { username: nextUsername } : {}),
      display_name: displayName || null,
      tagline: tagline || null,
      pronouns: pronouns || null,
      location: location || null,
      bio: bio || null,
      theme,
      showcases,
      featured_review_id: featuredReviewId || null,
      avatar_url: avatarUrl || null,
      banner_url: bannerUrl || null,
      streak_icon: streakIcon,
      profile_song_url: profileSongUrl || null,
      profile_song_title: profileSongTitle || null,
      spotify_url: links.spotify.trim() || null,
      soundcloud_url: links.soundcloud.trim() || null,
      statsfm_url: links.statsfm.trim() || null,
      apple_music_url: links.apple_music.trim() || null,
      // The five 039 platforms + the show/order list — only once the
      // columns exist (an unknown column fails the whole update).
      // visible_links keeps only keys that actually have a link.
      ...(supportsLinks039
        ? {
            instagram_url: links.instagram.trim() || null,
            x_url: links.x.trim() || null,
            discord_url: links.discord.trim() || null,
            amazon_music_url: links.amazon_music.trim() || null,
            youtube_music_url: links.youtube_music.trim() || null,
            visible_links: visibleLinks.filter((k) => !!links[k].trim()),
          }
        : {}),
      // Only sent once migration 027 exists — an unknown column would
      // fail the ENTIRE update, taking every other field with it.
      ...(supportsHideLinks
        ? { hide_streaming_links: hideStreamingLinks }
        : {}),
      // Featured playlist: empty clears it, a valid link saves the id,
      // an unparseable link leaves the saved value alone (the field
      // shows the red hint, nothing silently disappears).
      ...(supportsFeaturedPlaylist &&
      (featuredPlaylistLink.trim() === "" || parsePlaylistUrl(featuredPlaylistLink))
        ? { featured_playlist_id: parsePlaylistUrl(featuredPlaylistLink) }
        : {}),
      ...(supportsPreferredPlayer ? { preferred_player: preferredPlayer } : {}),
      // Hidden badges — only once migration 040 exists. An empty list
      // is stored as an empty array (= everything shows), never null,
      // so a member who un-hides everything ends up in a clean state.
      ...(supportsHiddenBadges ? { hidden_badges: hiddenBadges } : {}),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("profiles")
      // @ts-expect-error — Supabase Relationships type narrowing
      .update(updates)
      .eq("id", userId);

    if (updateError) {
      // The name-limit trigger (migration 028) raises coded messages —
      // translate them into human copy.
      const msg = updateError.message;
      if (msg.includes("USERNAME_COOLDOWN")) {
        const date = msg.match(/until (\d{4}-\d{2}-\d{2})/)?.[1];
        setError(
          `Usernames can only change once every 2 weeks — you can change yours again ${
            date ? `on ${date}` : "soon"
          }.`
        );
      } else if (msg.includes("DISPLAY_NAME_DAILY_LIMIT")) {
        setError(
          "Display names can only change twice a day — try again tomorrow."
        );
      } else if (msg.includes("USERNAME_RESERVED")) {
        setError("That username is reserved.");
      } else if (msg.includes("unique") || msg.includes("duplicate")) {
        setError("That username is already taken.");
      } else {
        setError(msg);
      }
    } else {
      if (usernameChanged) {
        setSavedUsername(nextUsername);
        setUsername(nextUsername);
        setUsernameChangedAt(new Date().toISOString());
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="osd-text text-xl animate-pulse">TUNING…</p>
      </div>
    );
  }

  const enabledSet = new Set(showcases);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">Customize Your Profile</h1>
        <p className="font-[family-name:var(--font-vt323)] text-lg text-text-secondary">
          pick a theme, arrange your showcases, make it yours
        </p>
      </div>

      {/* ===== LIVE PREVIEW — a mini profile card wearing the theme
             class, so switching themes recolors it instantly ===== */}
      <div className={`theme-${theme}`}>
        <div
          className="h-28 rounded-lg border border-white/10 relative overflow-hidden panel-xbox-glow"
          style={
            bannerUrl && bannerUrl.startsWith("https://")
              ? {
                  backgroundImage: `url(${bannerUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background: `linear-gradient(135deg, ${themeHex}33 0%, #0a0a0c 60%, ${themeHex}1a 100%)`,
                }
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {/* CH·USERNAME OSD tag removed here too (Luca 2026-08-22) —
              same green-kitsch cut as the real profile banner. */}
          <div className="absolute bottom-3 left-3 flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Preview"
                className="w-12 h-12 rounded-full border-2 object-cover"
                style={{ borderColor: themeHex }}
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold"
                style={{
                  borderColor: themeHex,
                  color: themeHex,
                  background: `${themeHex}20`,
                }}
              >
                {(displayName || username || "?")[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p
                className="font-[family-name:var(--font-heading)] font-bold text-sm"
                style={{ color: themeHex }}
              >
                {displayName || username || "Your Name"}
              </p>
              <p className="font-[family-name:var(--font-vt323)] text-xs text-text-muted">
                {tagline || "Live Preview"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <form id="profile-settings-form" onSubmit={handleSave} className="space-y-6">
        {/* Every section below is a collapsible SettingsSection (Luca
            2026-09-03: "dropdowns for settings since the page is
            starting to get a bit lengthy") — collapsed by default,
            open state remembered per section in localStorage. */}

        {/* ========== IDENTITY ========== */}
        <SettingsSection
          id="identity"
          title="Identity"
          hint="Display name, username, tagline, pronouns, location, bio."
          defaultOpen
        >

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Display Name">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={50}
                className="form-input"
              />
              {supportsNameLimits && (
                <p className="text-xs text-text-muted mt-1">
                  Can be changed up to twice a day.
                </p>
              )}
            </FormField>

            {/* Username — Instagram rules since migration 028 (Luca
                2026-08-31): changeable, but only once every 14 days.
                The DB trigger enforces it; this field mirrors it. Until
                the migration runs (columns absent) the old permanent-
                username behavior stays. */}
            <FormField label="Username">
              {supportsNameLimits && !usernameLocked ? (
                <input
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20)
                    )
                  }
                  placeholder="your_username"
                  maxLength={20}
                  className="form-input"
                />
              ) : (
                <p className="form-input opacity-60 cursor-not-allowed select-none">
                  @{username}
                </p>
              )}
              <p className="text-xs text-text-muted mt-1">
                {!supportsNameLimits
                  ? "Usernames are permanent — change your display name instead."
                  : usernameLocked
                    ? `You can change your username again on ${usernameNextAllowed!.toLocaleDateString()}.`
                    : "You can change your username once every 2 weeks — your profile URL changes with it."}
              </p>
            </FormField>
          </div>

          <FormField label={`Tagline (${tagline.length}/120)`}>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, 120))}
              placeholder="One line under your name — your motto, your era, whatever"
              maxLength={120}
              className="form-input"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Pronouns">
              <input
                type="text"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value.slice(0, 30))}
                placeholder="they/them"
                maxLength={30}
                className="form-input"
              />
            </FormField>

            <FormField label="Location">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value.slice(0, 60))}
                placeholder="City, planet, wherever"
                maxLength={60}
                className="form-input"
              />
            </FormField>
          </div>

          <FormField label={`Bio (${bio.length}/500)`}>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 500))}
              placeholder="Tell people about yourself..."
              rows={4}
              maxLength={500}
              className="form-input resize-none"
            />
          </FormField>
        </SettingsSection>

        {/* ========== APPEARANCE ========== */}
        <SettingsSection
          id="appearance"
          title="Appearance"
          hint="Theme preset, avatar, banner, streak icon."
        >

          {/* Theme presets — one card per preset. Each card wears its
              own theme-* class so the LABEL renders in that preset's
              actual heading font: the picker doubles as a type
              specimen. ("Vintage Consoles" tag dropped 2026-08-26 —
              LimeWire, Soul Reaper, and Robot Rock aren't consoles.) */}
          <div className="space-y-2">
            <p className="font-[family-name:var(--font-heading)] text-xs font-bold text-text-secondary uppercase tracking-wider">
              Theme Presets
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTheme(t.id);
                      setSaved(false);
                    }}
                    className={`theme-${t.id} flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all`}
                    style={{
                      background: active ? `${t.hex}18` : "rgba(255,255,255,0.03)",
                      border: `2px solid ${active ? t.hex : "rgba(255,255,255,0.1)"}`,
                      boxShadow: active ? `0 0 12px ${t.hex}40` : "none",
                    }}
                  >
                    {/* Swatch: a tiny glowing tube */}
                    <span
                      className="w-5 h-5 rounded-sm shrink-0 mt-0.5"
                      style={{
                        background: t.hex,
                        boxShadow: `0 0 8px ${t.hex}90`,
                      }}
                    />
                    <span className="min-w-0">
                      <span
                        className="block text-sm font-bold font-[family-name:var(--font-heading)]"
                        style={{ color: active ? t.hex : "#c8c8cc" }}
                      >
                        {t.label}
                      </span>
                      {/* Description stays in the site font for readability */}
                      <span className="block text-xs text-[#8a8a90] font-[family-name:var(--font-inter)]">
                        {t.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Avatar upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UploadField
              label="Avatar"
              hint="Square works best · max 2MB"
              currentUrl={avatarUrl}
              busy={uploadingAvatar}
              accent={themeHex}
              onFile={(file) =>
                handleUpload(file, "avatars", (url) => {
                  setAvatarUrl(url);
                  setSaved(false);
                }, setUploadingAvatar)
              }
              onClear={() => {
                setAvatarUrl("");
                setSaved(false);
              }}
            />

            <UploadField
              label="Banner"
              hint="Wide (~3:1) works best · max 6MB"
              currentUrl={bannerUrl}
              busy={uploadingBanner}
              accent={themeHex}
              wide
              onFile={(file) =>
                handleUpload(file, "banners", (url) => {
                  setBannerUrl(url);
                  setSaved(false);
                }, setUploadingBanner)
              }
              onClear={() => {
                setBannerUrl("");
                setSaved(false);
              }}
            />
          </div>

          {/* --- Streak icon — the animated counter on Song of the Day.
                Live previews: what you see is exactly what renders. --- */}
          <FormField label="Streak icon (Song of the Day)">
            <div className="flex flex-wrap gap-3">
              {(
                [
                  { id: "flame", label: "Flame" },
                  { id: "vinyl", label: "Vinyl" },
                  { id: "cd", label: "CD" },
                ] as { id: StreakIconChoice; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setStreakIcon(opt.id);
                    setSaved(false);
                  }}
                  className={`flex flex-col items-center gap-1 px-5 py-3 rounded-lg border transition-all ${
                    streakIcon === opt.id
                      ? "border-accent-primary bg-accent-primary/10"
                      : "border-border-subtle hover:border-border-bright"
                  }`}
                >
                  <StreakIndicator streak={7} icon={opt.id} size="sm" preview />
                  <span className="pixel-text text-xs uppercase tracking-widest text-text-secondary">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </FormField>
        </SettingsSection>

        {/* ========== SHOWCASES ========== */}
        <SettingsSection
          id="showcases"
          title="Showcases"
          hint="Which blocks appear on your profile, and in what order."
        >
          <p className="text-xs text-text-muted">
            Pick which blocks appear on your profile and drag their order
            with the arrows. Top of the list = top of your page.
          </p>

          {/* Enabled blocks first (in order), then the disabled pool. */}
          <div className="space-y-2">
            {[
              ...showcases
                .map((id) => SHOWCASE_OPTIONS.find((o) => o.id === id))
                .filter((o): o is (typeof SHOWCASE_OPTIONS)[number] => !!o),
              ...SHOWCASE_OPTIONS.filter((o) => !enabledSet.has(o.id)),
            ].map((opt) => {
              const enabled = enabledSet.has(opt.id);
              const idx = showcases.indexOf(opt.id);
              return (
                <div
                  key={opt.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                  style={{
                    background: enabled ? `${themeHex}0d` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${enabled ? `${themeHex}40` : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {/* On/off toggle */}
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleShowcase(opt.id)}
                    className="w-4 h-4 accent-current cursor-pointer"
                    style={{ color: themeHex }}
                    aria-label={`Toggle ${opt.label}`}
                  />

                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-bold font-[family-name:var(--font-heading)]"
                      style={{ color: enabled ? themeHex : "#9a9a9e" }}
                    >
                      {opt.label}
                    </p>
                    <p className="text-xs text-text-muted truncate">{opt.hint}</p>
                  </div>

                  {/* Reorder arrows — only for enabled blocks */}
                  {enabled && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveShowcase(opt.id, -1)}
                        disabled={idx === 0}
                        className="w-7 h-7 rounded border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/30 disabled:opacity-30 transition-colors"
                        aria-label={`Move ${opt.label} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveShowcase(opt.id, 1)}
                        disabled={idx === showcases.length - 1}
                        className="w-7 h-7 rounded border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/30 disabled:opacity-30 transition-colors"
                        aria-label={`Move ${opt.label} down`}
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Featured review picker — only meaningful when the
              showcase is enabled, but always safe to set. */}
          <FormField label="Feature Presentation — pinned review">
            <select
              value={featuredReviewId}
              onChange={(e) => {
                setFeaturedReviewId(e.target.value);
                setSaved(false);
              }}
              className="form-input"
            >
              <option value="">None</option>
              {myReviews.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} — {r.artist} ({r.rating}/10)
                </option>
              ))}
            </select>
            {myReviews.length === 0 && (
              <p className="text-xs text-text-muted mt-1">
                Write a review first — then you can pin it here.
              </p>
            )}
          </FormField>
        </SettingsSection>

        {/* ========== BADGES (migration 040) — every profile wears the
            three computed badges + any awarded ones under the username;
            here you untick the ones you'd rather keep to yourself.
            Nothing is deleted — hidden badges still show for YOU,
            dimmed. Appears once the column exists. ========== */}
        {supportsHiddenBadges && (
          <SettingsSection
            id="badges"
            title="Badges"
            hint="Choose which badges show under your username."
          >
            <p className="text-xs text-text-muted">
              Every profile wears a reviews trophy, a likes trophy and a
              years-of-service badge under the username, plus any badge
              you&apos;ve been awarded. Untick the ones you&apos;d rather
              keep to yourself — nothing is deleted, and you&apos;ll still
              see hidden ones dimmed on your own profile.
            </p>

            <div className="space-y-2">
              {[
                ...COMPUTED_BADGE_KEYS.map((key) => ({
                  key,
                  label: COMPUTED_BADGE_INFO[key].label,
                  description: COMPUTED_BADGE_INFO[key].description,
                })),
                // Awarded event badges this member holds — only the ones
                // this build can draw (an unknown key never shows on the
                // profile either, so there's nothing to hide).
                ...myEventBadges.flatMap((b) => {
                  const def = eventBadge(b.badge_key);
                  if (!def) return [];
                  return [
                    {
                      key: b.badge_key,
                      label: `${def.glyph} ${def.label}`,
                      description: b.note ?? def.description,
                    },
                  ];
                }),
              ].map((b) => {
                const shown = !hiddenBadges.includes(b.key);
                return (
                  <label
                    key={b.key}
                    className="flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer select-none transition-colors"
                    style={{
                      borderColor: shown ? `${themeHex}40` : "rgba(255,255,255,0.12)",
                      background: shown ? `${themeHex}0d` : "rgba(0,0,0,0.25)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={shown}
                      onChange={(e) => {
                        const show = e.target.checked;
                        setHiddenBadges((prev) =>
                          show
                            ? prev.filter((k) => k !== b.key)
                            : prev.includes(b.key)
                              ? prev
                              : [...prev, b.key]
                        );
                        setSaved(false);
                      }}
                      className="w-4 h-4 mt-0.5 shrink-0 accent-current cursor-pointer"
                      style={{ color: themeHex }}
                      aria-label={`Show ${b.label} on my profile`}
                    />
                    <span className="min-w-0">
                      <span
                        className="block text-sm font-bold font-[family-name:var(--font-heading)]"
                        style={{ color: shown ? themeHex : "#c8c8cc" }}
                      >
                        {b.label}
                        {!shown && (
                          <span className="ml-2 pixel-text text-[11px] uppercase tracking-wider text-text-muted">
                            hidden
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-text-muted">
                        {b.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </SettingsSection>
        )}

        {/* ========== PREVIEW PLAYER (migration 036) — which player
            release pages show YOU. One or the other, never both. ========== */}
        {supportsPreferredPlayer && (
          <SettingsSection
            id="preview-player"
            title="Preview Player"
            hint="Spotify or Apple Music on release pages."
          >
            <p className="text-xs text-text-muted">
              Release pages show one preview player. Pick the service you
              actually use — signed in to it in your browser, previews
              become full tracks.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  ["spotify", "Spotify", "The default. Every release we have."],
                  ["apple", "Apple Music", "Where Apple carries the record; otherwise Spotify fills in."],
                ] as const
              ).map(([id, label, blurb]) => {
                const active = preferredPlayer === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setPreferredPlayer(id);
                      setSaved(false);
                    }}
                    className="text-left p-3 rounded-lg border transition-colors"
                    style={{
                      borderColor: active ? themeHex : "rgba(255,255,255,0.12)",
                      background: active ? `${themeHex}14` : "rgba(0,0,0,0.25)",
                    }}
                  >
                    <span
                      className="block text-sm font-bold font-[family-name:var(--font-heading)]"
                      style={{ color: active ? themeHex : "#c8c8cc" }}
                    >
                      {active ? "● " : "○ "}
                      {label}
                    </span>
                    <span className="block text-xs text-text-muted mt-0.5">{blurb}</span>
                  </button>
                );
              })}
            </div>
          </SettingsSection>
        )}

        {/* ========== PROFILE SONG — picked from the catalog, same
            flow as reviews. No pasted URLs. When Spotify has a 30s
            preview for the track it plays right on your profile;
            otherwise the song shows as a tappable link. ========== */}
        <SettingsSection
          id="profile-song"
          title="Profile Song"
          hint="One track from the catalog, playing on your profile."
          overflowVisible
        >

          {profileSongTitle ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border-medium bg-bg-elevated/50">
              <span className="text-xl">♪</span>
              <span className="min-w-0 flex-1 text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)]">
                {profileSongTitle}
              </span>
              <button
                type="button"
                onClick={() => {
                  setProfileSongTitle("");
                  setProfileSongUrl("");
                  setSongRelease(null);
                }}
                className="label-xbox hover:text-accent-rose transition-colors text-[0.65rem] shrink-0"
              >
                Remove
              </button>
            </div>
          ) : songRelease ? (
            /* Release picked — now choose WHICH track on it. */
            <div className="space-y-2">
              <p className="text-xs text-text-muted">
                Pick the track from{" "}
                <span className="text-text-primary font-bold">
                  {songRelease.release.title}
                </span>
                :
              </p>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border-subtle divide-y divide-border-subtle">
                {(songRelease.release.tracks ?? []).map((t) => (
                  <button
                    key={`${t.position}-${t.title}`}
                    type="button"
                    onClick={() => {
                      setProfileSongTitle(
                        `${t.title} — ${songRelease.artist_name}`
                      );
                      // Best playable/linkable target we have, in order:
                      // 30s Spotify preview → Spotify track page → our
                      // own release page.
                      setProfileSongUrl(
                        t.preview_url ||
                          (t.spotify_id
                            ? `https://open.spotify.com/track/${t.spotify_id}`
                            : `/releases/${songRelease.release.slug}`)
                      );
                      setSongRelease(null);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-bg-elevated transition-colors"
                  >
                    <span className="pixel-text text-xs text-text-muted w-6 shrink-0 tabular-nums">
                      {t.position}
                    </span>
                    <span className="text-text-primary truncate">{t.title}</span>
                    {t.preview_url && (
                      <span className="ml-auto pixel-text text-[10px] text-accent-primary shrink-0">
                        ▶ PREVIEW
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSongRelease(null)}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                ← different release
              </button>
            </div>
          ) : (
            <CatalogSearch
              onPick={(pick) => setSongRelease(pick)}
              placeholder="Search for your profile song…"
            />
          )}
        </SettingsSection>

        {/* ========== CONNECTED PLATFORMS ==========
            (Luca 2026-09-02) One row per platform: paste a link, tick
            whether it shows on your profile, arrow it left/right.
            Shown platforms come first in their display order, then
            the rest. Pre-039 databases only get the four original
            streaming platforms and no show/order controls (legacy:
            every saved link shows). */}
        <SettingsSection
          id="connected-platforms"
          title="Connected Platforms"
          hint="Streaming and social links, featured playlist, link privacy."
        >
          <p className="text-xs text-text-muted">
            Drop a link for any platform you use. Ticked ones show on
            your profile, left to right in this order — use the arrows
            to reorder. A link that isn&apos;t from that platform
            won&apos;t save.
          </p>

          <div className="space-y-2">
            {[
              ...visibleLinks.map((k) => getPlatform(k)),
              ...PLATFORMS.filter((pl) => !visibleLinks.includes(pl.key)),
            ]
              .filter((pl) => pl.legacy || supportsLinks039)
              .map((pl) => {
                const value = links[pl.key];
                const shown = visibleLinks.includes(pl.key);
                const idx = visibleLinks.indexOf(pl.key);
                const invalid = !!value.trim() && !isValidPlatformUrl(pl, value);
                const tint = shown ? themeHex : "#9a9a9e";
                return (
                  <div
                    key={pl.key}
                    className="rounded-lg px-3 py-2.5 space-y-2"
                    style={{
                      background: shown ? `${themeHex}0d` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${shown ? `${themeHex}40` : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {supportsLinks039 && (
                        <input
                          type="checkbox"
                          checked={shown}
                          disabled={!value.trim()}
                          onChange={() => toggleLink(pl.key)}
                          className="w-4 h-4 accent-current cursor-pointer disabled:opacity-30"
                          style={{ color: themeHex }}
                          aria-label={`Show ${pl.label} on my profile`}
                        />
                      )}
                      <span className="shrink-0" style={{ color: tint }}>
                        <PlatformIcon platform={pl.key} className="w-5 h-5" />
                      </span>
                      <p
                        className="text-sm font-bold font-[family-name:var(--font-heading)] flex-1 min-w-0 truncate"
                        style={{ color: tint }}
                      >
                        {pl.label}
                        {shown && supportsLinks039 && (
                          <span className="ml-2 pixel-text text-[10px] text-text-muted font-normal">
                            #{idx + 1} on profile
                          </span>
                        )}
                      </p>
                      {supportsLinks039 && shown && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveLink(pl.key, -1)}
                            disabled={idx === 0}
                            className="w-7 h-7 rounded border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/30 disabled:opacity-30 transition-colors"
                            aria-label={`Move ${pl.label} left`}
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLink(pl.key, 1)}
                            disabled={idx === visibleLinks.length - 1}
                            className="w-7 h-7 rounded border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/30 disabled:opacity-30 transition-colors"
                            aria-label={`Move ${pl.label} right`}
                          >
                            →
                          </button>
                        </div>
                      )}
                    </div>
                    <input
                      type="url"
                      value={value}
                      onChange={(e) => setLink(pl.key, e.target.value)}
                      placeholder={pl.placeholder}
                      className="form-input"
                      spellCheck={false}
                      autoComplete="off"
                      aria-label={`${pl.label} link`}
                    />
                    {invalid && (
                      <p className="text-xs text-accent-rose">
                        Not a {pl.label} link — paste a{" "}
                        {pl.hosts[0].replace(".*", ".com")} URL. (Won&apos;t be
                        saved until it&apos;s fixed or cleared.)
                      </p>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Featured playlist (Luca 2026-09-02): a Spotify playlist
              embedded on the profile with its own player, under the
              profile song. Appears once migration 035 has run. */}
          {supportsFeaturedPlaylist && (
            <FormField label="Featured Spotify playlist">
              <input
                type="text"
                value={featuredPlaylistLink}
                onChange={(e) => setFeaturedPlaylistLink(e.target.value)}
                placeholder="https://open.spotify.com/playlist/…"
                className="form-input"
                spellCheck={false}
                autoComplete="off"
              />
              {featuredPlaylistLink.trim() && parsePlaylistUrl(featuredPlaylistLink) && (
                <p className="mt-1.5 text-xs text-accent-primary pixel-text">
                  ✓ Playlist detected — it&apos;ll play on your profile.
                </p>
              )}
              {featuredPlaylistLink.trim() && !parsePlaylistUrl(featuredPlaylistLink) && (
                <p className="mt-1.5 text-xs text-accent-rose">
                  Not a Spotify playlist link — paste an
                  open.spotify.com/playlist/… URL. (Won&apos;t be saved until
                  it&apos;s fixed or cleared.)
                </p>
              )}
            </FormField>
          )}

          {/* Privacy toggle (Luca 2026-08-28): connect whatever you
              want, choose whether visitors see it. Appears once
              migration 027 has run — see supportsHideLinks above. */}
          {supportsHideLinks && (
            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={hideStreamingLinks}
                onChange={(e) => {
                  setHideStreamingLinks(e.target.checked);
                  setSaved(false);
                }}
                className="w-4 h-4 mt-0.5 shrink-0 accent-current cursor-pointer"
                style={{ color: themeHex }}
              />
              <span className="min-w-0">
                <span
                  className="block text-sm font-bold font-[family-name:var(--font-heading)]"
                  style={{ color: hideStreamingLinks ? themeHex : "#c8c8cc" }}
                >
                  Don&apos;t show these on my profile
                </span>
                <span className="block text-xs text-text-muted">
                  Your links stay saved and keep powering things like the
                  stats.fm showcases — visitors just won&apos;t see the
                  icon row on your profile.
                </span>
              </span>
            </label>
          )}
        </SettingsSection>

      </form>

      {/* Four Favorites editor removed 2026-08-26 (Luca) — the whole
          module left customization; profile_favorites rows and the
          /api/profile/favorites route sit untouched in case it ever
          returns. */}

      {/* ========== SAVE ==========
          At the bottom, after everything editable (Luca 2026-08-22),
          but ABOVE account deletion. Outside the <form> element, so
          the submit button reaches it via form= (favorite-genres UI
          removed the same day — the editor and the profile pill row;
          old favorite_genres rows just sit untouched in the DB). */}
      {error && (
        <div className="panel-xbox p-4 border-red-500/30 bg-red-500/5">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {saved && (
        <div
          className="panel-xbox p-4"
          style={{ borderColor: `${themeHex}30`, background: `${themeHex}08` }}
        >
          <p style={{ color: themeHex }} className="text-sm font-bold">
            Saved. Your profile is updated.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          form="profile-settings-form"
          disabled={saving}
          className="btn-y2k btn-y2k-primary disabled:opacity-50"
          style={{ background: themeHex, borderColor: themeHex, color: "#0a0a0c" }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <button
          type="button"
          onClick={() => router.push(`/profile/${username}`)}
          className="btn-y2k btn-y2k-outline"
        >
          View Profile
        </button>
      </div>

      {/* ========== PASSWORD ========== */}
      <SettingsSection
        id="password"
        title="Password"
        hint="Pick a new one — takes effect everywhere you're signed in."
      >
        <ChangePasswordSection />
      </SettingsSection>

      {/* ========== PERFORMANCE ==========
          Low detail mode (Luca 2026-09-03) — the phone/app GPU diet as
          an opt-in for any device. Per DEVICE (localStorage), not part
          of the profile form, so it sits outside <form> with no Save. */}
      <SettingsSection
        id="performance"
        title={tSettings("performance")}
        hint={tSettings("performanceHint")}
      >
        <LowDetailToggle variant="row" accent={themeHex} />
      </SettingsSection>

      {/* ========== LANGUAGE ==========
          LANGUAGES (Luca 2026-09-03) — per device like low detail:
          a cookie, not a profile column, so it's outside the form. */}
      <SettingsSection
        id="language"
        title={tSettings("language")}
        hint={tSettings("languageHint")}
      >
        <LanguagePicker variant="row" accent={themeHex} />
      </SettingsSection>

      {/* ========== ACCOUNT DELETION ==========
          In-app account deletion — App Store guideline 5.1.1(v)
          requires it wherever account creation exists. Always LAST. */}
      <SettingsSection
        id="account-deletion"
        title="Account Deletion"
        hint="Remove your profile and everything you made. No undo."
        accent="#e05575"
        className="border-[#e0557540]"
      >
        <DeleteAccountSection username={username} />
      </SettingsSection>
    </div>
  );
}

/* ============================================
   Upload field — file picker + preview + clear
   ============================================ */

function UploadField({
  label,
  hint,
  currentUrl,
  busy,
  accent,
  wide = false,
  onFile,
  onClear,
}: {
  label: string;
  hint: string;
  currentUrl: string;
  busy: boolean;
  accent: string;
  wide?: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="font-[family-name:var(--font-heading)] text-xs font-bold text-text-secondary uppercase tracking-wider">
        {label}
      </p>

      {/* Preview */}
      {currentUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={`${label} preview`}
            className={
              wide
                ? "h-14 w-40 rounded object-cover border border-white/10"
                : "h-14 w-14 rounded-full object-cover border border-white/10"
            }
          />
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors font-[family-name:var(--font-heading)]"
          >
            Remove
          </button>
        </div>
      ) : (
        <p className="pixel-text text-sm text-text-muted">none set</p>
      )}

      {/* Picker — a styled label wrapping a hidden file input */}
      <label
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all font-[family-name:var(--font-heading)]"
        style={{
          background: `${accent}12`,
          border: `1px solid ${accent}40`,
          color: accent,
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy ? "Uploading…" : `Upload ${label}`}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = ""; // allow re-picking the same file
          }}
        />
      </label>
      <p className="text-xs text-text-muted">{hint}</p>
    </div>
  );
}

/* ============================================
   Form Field wrapper component
   ============================================ */

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-[family-name:var(--font-heading)] text-xs font-bold text-text-secondary uppercase tracking-wider block">
        {label}
      </label>
      {children}
    </div>
  );
}
