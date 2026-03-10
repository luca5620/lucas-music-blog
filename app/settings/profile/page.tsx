"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";

const GENRE_OPTIONS = [
  "Hip-Hop",
  "Pop",
  "R&B",
  "Alternative",
  "Rock",
  "Electronic",
  "Jazz",
  "Classical",
  "Country",
  "Latin",
  "Metal",
  "Indie",
  "Folk",
  "Soul",
  "Funk",
  "Punk",
  "Blues",
  "K-Pop",
  "J-Pop",
  "Reggaeton",
];

export default function ProfileSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [profileColor, setProfileColor] = useState("#1e90ff");
  const [profileGradient, setProfileGradient] = useState("");
  const [profileSongUrl, setProfileSongUrl] = useState("");
  const [profileSongTitle, setProfileSongTitle] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [soundcloudUrl, setSoundcloudUrl] = useState("");
  const [statsfmUrl, setStatsfmUrl] = useState("");
  const [appleMusicUrl, setAppleMusicUrl] = useState("");
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);

  // Load profile data
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        const p = profile as Profile;
        setDisplayName(p.display_name ?? "");
        setUsername(p.username ?? "");
        setBio(p.bio ?? "");
        setAvatarUrl(p.avatar_url ?? "");
        setBannerUrl(p.banner_url ?? "");
        setProfileColor(p.profile_color ?? "#1e90ff");
        setProfileGradient(p.profile_gradient ?? "");
        setProfileSongUrl(p.profile_song_url ?? "");
        setProfileSongTitle(p.profile_song_title ?? "");
        setSpotifyUrl(p.spotify_url ?? "");
        setSoundcloudUrl(p.soundcloud_url ?? "");
        setStatsfmUrl(p.statsfm_url ?? "");
        setAppleMusicUrl(p.apple_music_url ?? "");
        setFavoriteGenres(p.favorite_genres ?? []);
      }

      setLoading(false);
    }

    loadProfile();
  }, [router, supabase]);

  // Toggle genre selection
  const toggleGenre = useCallback((genre: string) => {
    setFavoriteGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : [...prev, genre]
    );
  }, []);

  // Save profile
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    // Validate username
    if (!username.trim()) {
      setError("Username is required.");
      setSaving(false);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError(
        "Username can only contain letters, numbers, hyphens, and underscores."
      );
      setSaving(false);
      return;
    }

    if (username.length < 3 || username.length > 30) {
      setError("Username must be between 3 and 30 characters.");
      setSaving(false);
      return;
    }

    const updates: Partial<Profile> = {
      display_name: displayName || null,
      username,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      banner_url: bannerUrl || null,
      profile_color: profileColor || "#1e90ff",
      profile_gradient: profileGradient || null,
      profile_song_url: profileSongUrl || null,
      profile_song_title: profileSongTitle || null,
      spotify_url: spotifyUrl || null,
      soundcloud_url: soundcloudUrl || null,
      statsfm_url: statsfmUrl || null,
      apple_music_url: appleMusicUrl || null,
      favorite_genres: favoriteGenres,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("profiles")
      // @ts-expect-error — Supabase Relationships type narrowing
      .update(updates)
      .eq("id", userId);

    if (updateError) {
      if (updateError.message.includes("unique")) {
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
        <p className="font-[family-name:var(--font-vt323)] text-xl text-[#5a5a60] animate-pulse">
          Loading profile...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl sm:text-4xl font-extrabold text-[#e8e6e3]">
          Edit Profile
        </h1>
        <p className="font-[family-name:var(--font-vt323)] text-lg text-[#9a9a9e]">
          customize your page, make it yours
        </p>
      </div>

      {/* Live color/gradient preview */}
      <div
        className="h-24 rounded-lg border border-white/10 relative overflow-hidden"
        style={
          profileGradient
            ? { background: profileGradient }
            : {
                background: `linear-gradient(135deg, ${profileColor}33 0%, #0a0a0c 50%, ${profileColor}1a 100%)`,
              }
        }
      >
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt="Preview"
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: profileColor }}
            />
          )}
          <div>
            <p
              className="font-[family-name:var(--font-space-grotesk)] font-bold text-sm"
              style={{ color: profileColor }}
            >
              {displayName || username || "Your Name"}
            </p>
            <p className="font-[family-name:var(--font-vt323)] text-xs text-[#5a5a60]">
              Live Preview
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* ========== BASIC INFO ========== */}
        <fieldset className="panel-xbox p-5 space-y-4">
          <legend className="label-xbox">Basic Info</legend>

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

            <FormField label="Username">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="your-username"
                maxLength={30}
                className="form-input"
              />
              <p className="text-xs text-[#5a5a60] mt-1">
                Letters, numbers, hyphens, underscores only
              </p>
            </FormField>
          </div>

          <FormField label={`Bio (${bio.length}/500)`}>
            <textarea
              value={bio}
              onChange={(e) =>
                setBio(e.target.value.slice(0, 500))
              }
              placeholder="Tell people about yourself..."
              rows={4}
              maxLength={500}
              className="form-input resize-none"
            />
          </FormField>
        </fieldset>

        {/* ========== APPEARANCE ========== */}
        <fieldset className="panel-xbox p-5 space-y-4">
          <legend className="label-xbox">Appearance</legend>

          <FormField label="Avatar URL">
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="form-input"
            />
          </FormField>

          <FormField label="Banner URL">
            <input
              type="url"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://example.com/banner.jpg"
              className="form-input"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Profile Color">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={profileColor}
                  onChange={(e) => setProfileColor(e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer bg-transparent border border-white/10"
                />
                <input
                  type="text"
                  value={profileColor}
                  onChange={(e) => setProfileColor(e.target.value)}
                  placeholder="#1e90ff"
                  className="form-input flex-1"
                />
              </div>
            </FormField>

            <FormField label="Profile Gradient (CSS)">
              <input
                type="text"
                value={profileGradient}
                onChange={(e) => setProfileGradient(e.target.value)}
                placeholder="linear-gradient(135deg, #ff00ff, #00ffff)"
                className="form-input"
              />
              <p className="text-xs text-[#5a5a60] mt-1">
                Optional. Overrides banner if no image set.
              </p>
            </FormField>
          </div>
        </fieldset>

        {/* ========== PROFILE SONG ========== */}
        <fieldset className="panel-xbox p-5 space-y-4">
          <legend className="label-xbox">Profile Song</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Song Title">
              <input
                type="text"
                value={profileSongTitle}
                onChange={(e) => setProfileSongTitle(e.target.value)}
                placeholder="My favorite song"
                className="form-input"
              />
            </FormField>

            <FormField label="Song URL (audio file)">
              <input
                type="url"
                value={profileSongUrl}
                onChange={(e) => setProfileSongUrl(e.target.value)}
                placeholder="https://example.com/song.mp3"
                className="form-input"
              />
            </FormField>
          </div>
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

        {/* ========== FAVORITE GENRES ========== */}
        <fieldset className="panel-xbox p-5 space-y-4">
          <legend className="label-xbox">Favorite Genres</legend>

          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((genre) => {
              const selected = favoriteGenres.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all font-[family-name:var(--font-vt323)] text-sm"
                  style={
                    selected
                      ? {
                          background: `${profileColor}25`,
                          border: `2px solid ${profileColor}`,
                          color: profileColor,
                          boxShadow: `0 0 8px ${profileColor}30`,
                        }
                      : {
                          background: "rgba(255,255,255,0.03)",
                          border: "2px solid rgba(255,255,255,0.1)",
                          color: "#5a5a60",
                        }
                  }
                >
                  {genre}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[#5a5a60]">
            Click to select your favorite genres. They appear on your profile.
          </p>
        </fieldset>

        {/* ========== SAVE ========== */}
        {error && (
          <div className="panel-xbox p-4 border-red-500/30 bg-red-500/5">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {saved && (
          <div
            className="panel-xbox p-4"
            style={{
              borderColor: `${profileColor}30`,
              background: `${profileColor}08`,
            }}
          >
            <p style={{ color: profileColor }} className="text-sm font-bold">
              Profile saved successfully!
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-y2k btn-y2k-primary disabled:opacity-50"
            style={{
              background: profileColor,
              borderColor: profileColor,
            }}
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>

          <button
            type="button"
            onClick={() => router.push(`/profile/${username}`)}
            className="btn-y2k btn-y2k-outline"
          >
            View Profile
          </button>
        </div>
      </form>
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
      <label className="font-[family-name:var(--font-space-grotesk)] text-xs font-bold text-[#9a9a9e] uppercase tracking-wider block">
        {label}
      </label>
      {children}
    </div>
  );
}
