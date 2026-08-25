"use client";

/**
 * Profile Settings — the customization studio.
 *
 * Steam-style: you don't just edit text fields, you SKIN your page.
 *  - Identity: name, tagline, pronouns, location, bio
 *  - Appearance: a "vintage consoles" theme preset (live preview —
 *    each preset swaps accents, fonts, AND panel styling) + real
 *    avatar/banner uploads to Supabase Storage (no more URL pasting)
 *  - Showcases: choose WHICH blocks appear on your profile and in
 *    what order (favorites, stats, recent reviews, featured review,
 *    badges, lists, anticipated)
 *  - Featured review, profile song, streaming links, genres
 *
 * Saves happen via the Supabase browser client updating your own
 * profiles row — RLS guarantees you can only ever touch your own.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import FavoritesEditor from "@/components/profile/FavoritesEditor";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import ChangePasswordSection from "@/components/settings/ChangePasswordSection";
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

/* Theme presets — "vintage consoles". Ids and hexes must match the
   theme-* classes in globals.css AND the DB constraint from migration
   006. The swatch shows the accent; the theme-* class does the real
   work (accents, heading font, panel styling). */
const THEMES: { id: ProfileTheme; label: string; hex: string; desc: string }[] = [
  { id: "crt-blue", label: "Broadcast", hex: "#1e90ff", desc: "The standard Peak Music Reviews look" },
  { id: "ps3", label: "PS3 · XMB", hex: "#7ec9e8", desc: "Black void, silver-blue shimmer, thin airy type" },
  { id: "ps4", label: "PS4", hex: "#4a90d9", desc: "Deep PlayStation blue, clean and modern" },
  { id: "xbox-og", label: "Xbox OG", hex: "#5dc21e", desc: "Acid green on black metal, industrial type" },
  { id: "xbox-360", label: "Xbox 360", hex: "#92c83e", desc: "Blade-dashboard green, glossy and friendly" },
  { id: "wii", label: "Wii", hex: "#35b7d8", desc: "White channel cards, rounded and cheerful" },
  { id: "limewire", label: "LimeWire", hex: "#32cd32", desc: "Where internet music began — beveled freeware beige" },
  { id: "bleach", label: "Soul Reaper", hex: "#e3342f", desc: "Manga ink — stark black & white with a blood-red slash" },
  { id: "daft-punk", label: "Robot Rock", hex: "#f0b93c", desc: "Helmet chrome and Discovery gold, neon horizon" },
];

/* Every showcase block a profile can display. */
const SHOWCASE_OPTIONS: { id: ShowcaseType; label: string; hint: string }[] = [
  { id: "favorites", label: "Four Favorites", hint: "Your Letterboxd-style top shelf" },
  { id: "stats", label: "Taste Readout", hint: "Review count, average, rating histogram" },
  { id: "recent_reviews", label: "Now Showing", hint: "Your latest 8 reviews as a poster wall" },
  { id: "featured_review", label: "Feature Presentation", hint: "One pinned review, front and center" },
  { id: "badges", label: "Credentials", hint: "Verified badge, member since, transmission count" },
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
    "favorites", "stats", "recent_reviews",
  ]);
  const [featuredReviewId, setFeaturedReviewId] = useState<string>("");
  const [myReviews, setMyReviews] = useState<Pick<Review, "id" | "title" | "artist" | "rating">[]>([]);

  // --- Song / links / genres ---
  const [profileSongUrl, setProfileSongUrl] = useState("");
  const [profileSongTitle, setProfileSongTitle] = useState("");
  // Catalog pick in progress for the profile song (release chosen,
  // track not yet chosen). Not persisted — only title/url are saved.
  const [songRelease, setSongRelease] = useState<CatalogPick | null>(null);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [soundcloudUrl, setSoundcloudUrl] = useState("");
  const [statsfmUrl, setStatsfmUrl] = useState("");
  const [appleMusicUrl, setAppleMusicUrl] = useState("");

  const themeHex = THEMES.find((t) => t.id === theme)?.hex ?? "#1e90ff";

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

      const [{ data: profile }, { data: reviews }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("reviews")
          .select("id, title, artist, rating")
          .eq("user_id", user.id)
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (profile) {
        const p = profile as Profile;
        setDisplayName(p.display_name ?? "");
        setUsername(p.username ?? "");
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
            : ["favorites", "stats", "recent_reviews"]
        );
        setFeaturedReviewId(p.featured_review_id ?? "");
        setProfileSongUrl(p.profile_song_url ?? "");
        setProfileSongTitle(p.profile_song_title ?? "");
        setSpotifyUrl(p.spotify_url ?? "");
        setSoundcloudUrl(p.soundcloud_url ?? "");
        setStatsfmUrl(p.statsfm_url ?? "");
        setAppleMusicUrl(p.apple_music_url ?? "");
      }

      setMyReviews(
        (reviews ?? []) as Pick<Review, "id" | "title" | "artist" | "rating">[]
      );
      setLoading(false);
    }

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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

    // Streaming links must come from their actual services — these
    // render as clickable links on your PUBLIC profile, so nothing
    // else is allowed (the database enforces the same rule).
    const linkRules: { value: string; prefixes: string[]; label: string }[] = [
      {
        value: spotifyUrl,
        prefixes: ["https://open.spotify.com/"],
        label: "Spotify link must start with https://open.spotify.com/",
      },
      {
        value: soundcloudUrl,
        prefixes: [
          "https://soundcloud.com/",
          "https://www.soundcloud.com/",
          "https://on.soundcloud.com/",
        ],
        label: "SoundCloud link must start with https://soundcloud.com/",
      },
      {
        value: statsfmUrl,
        prefixes: ["https://stats.fm/", "https://www.stats.fm/", "https://spotistats.app/"],
        label: "stats.fm link must start with https://stats.fm/",
      },
      {
        value: appleMusicUrl,
        prefixes: ["https://music.apple.com/"],
        label: "Apple Music link must start with https://music.apple.com/",
      },
    ];
    for (const rule of linkRules) {
      const v = rule.value.trim();
      if (v && !rule.prefixes.some((p) => v.startsWith(p))) {
        setError(rule.label);
        setSaving(false);
        return;
      }
    }

    // username deliberately absent — permanent after signup.
    const updates: Partial<Profile> = {
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
      spotify_url: spotifyUrl || null,
      soundcloud_url: soundcloudUrl || null,
      statsfm_url: statsfmUrl || null,
      apple_music_url: appleMusicUrl || null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("profiles")
      // @ts-expect-error — Supabase Relationships type narrowing
      .update(updates)
      .eq("id", userId);

    if (updateError) {
      if (updateError.message.includes("unique") || updateError.message.includes("duplicate")) {
        setError("That username is already taken.");
      } else {
        setError(updateError.message);
      }
    } else {
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
        {/* ========== IDENTITY ========== */}
        <fieldset className="panel-xbox p-5 space-y-4">
          <legend className="label-xbox">Identity</legend>

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
            </FormField>

            {/* Username is PERMANENT (Luca 2026-08-22) — it's the
                profile URL and the login identifier; only the display
                name is editable. Shown, not editable. */}
            <FormField label="Username">
              <p className="form-input opacity-60 cursor-not-allowed select-none">
                @{username}
              </p>
              <p className="text-xs text-text-muted mt-1">
                Usernames are permanent — change your display name instead.
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
        </fieldset>

        {/* ========== APPEARANCE ========== */}
        <fieldset className="panel-xbox p-5 space-y-5">
          <legend className="label-xbox">Appearance</legend>

          {/* Theme presets — one card per vintage console. Each card
              wears its own theme-* class so the LABEL renders in that
              preset's actual heading font: the picker doubles as a
              type specimen. */}
          <div className="space-y-2">
            <p className="font-[family-name:var(--font-heading)] text-xs font-bold text-text-secondary uppercase tracking-wider">
              Theme Presets — Vintage Consoles
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
        </fieldset>

        {/* ========== SHOWCASES ========== */}
        <fieldset className="panel-xbox p-5 space-y-4">
          <legend className="label-xbox">Showcases</legend>
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
        </fieldset>

        {/* ========== PROFILE SONG — picked from the catalog, same
            flow as reviews. No pasted URLs. When Spotify has a 30s
            preview for the track it plays right on your profile;
            otherwise the song shows as a tappable link. ========== */}
        <fieldset className="panel-xbox overflow-visible p-5 space-y-4">
          <legend className="label-xbox">Profile Song</legend>

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
        </fieldset>

        {/* ========== STREAMING LINKS ========== */}
        <fieldset className="panel-xbox p-5 space-y-4">
          <legend className="label-xbox">Streaming Links</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Spotify">
              <input
                type="url"
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                placeholder="https://open.spotify.com/user/..."
                className="form-input"
              />
            </FormField>

            <FormField label="SoundCloud">
              <input
                type="url"
                value={soundcloudUrl}
                onChange={(e) => setSoundcloudUrl(e.target.value)}
                placeholder="https://soundcloud.com/..."
                className="form-input"
              />
            </FormField>

            <FormField label="stats.fm">
              <input
                type="url"
                value={statsfmUrl}
                onChange={(e) => setStatsfmUrl(e.target.value)}
                placeholder="https://stats.fm/user/..."
                className="form-input"
              />
            </FormField>

            <FormField label="Apple Music">
              <input
                type="url"
                value={appleMusicUrl}
                onChange={(e) => setAppleMusicUrl(e.target.value)}
                placeholder="https://music.apple.com/..."
                className="form-input"
              />
            </FormField>
          </div>
        </fieldset>

      </form>

      {/* ========== FOUR FAVORITES ==========
          Lives outside the main form because it saves through its own
          API route (/api/profile/favorites) with its own button. */}
      <fieldset className="panel-xbox p-5 space-y-4">
        <legend className="label-xbox">Four Favorites</legend>
        <FavoritesEditor />
      </fieldset>

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
      <ChangePasswordSection />

      {/* ========== ACCOUNT DELETION ==========
          In-app account deletion — App Store guideline 5.1.1(v)
          requires it wherever account creation exists. Always LAST. */}
      <DeleteAccountSection username={username} />
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
