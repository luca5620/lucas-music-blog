"use client";

/**
 * PostForm — the freeform sibling of ReviewForm.
 *
 * A post is: a title, a body (up to 10k chars), optionally ONE video
 * (YouTube or TikTok URL — parsed live so the user sees what we
 * detected before submitting), and optionally a tied catalog release
 * picked through CatalogSearch (same ensure-import flow as reviews).
 *
 * The pasted video URL never leaves the client raw-vs-parsed ambiguity:
 * the server re-parses it with the same lib/video.ts allowlist and
 * stores only the extracted platform id.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Post, Release } from "@/lib/types/database";
import CatalogSearch, {
  type CatalogPick,
} from "@/components/catalog/CatalogSearch";
import { parseVideoUrl, isTikTokShortLink } from "@/lib/video";
import { parsePlaylistUrl, playlistUrl as buildPlaylistUrl } from "@/lib/playlist";
import { useTranslations } from "next-intl";

const BODY_MAX = 10000;

/** Rebuild a canonical URL from the stored (kind, id) pair so the
    edit form's video field starts filled. Both shapes re-parse to the
    same id through lib/video.ts. */
function videoUrlFromPost(post: Post): string {
  if (!post.video_kind || !post.video_id) return "";
  return post.video_kind === "youtube"
    ? `https://www.youtube.com/watch?v=${post.video_id}`
    : `https://www.tiktok.com/@user/video/${post.video_id}`;
}

export default function PostForm({
  post,
  initialRelease = null,
  initialArtist = "",
}: {
  /** Present = edit mode: PATCH this post instead of creating one. */
  post?: Post;
  initialRelease?: Release | null;
  initialArtist?: string;
}) {
  const router = useRouter();
  const editing = !!post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [videoUrl, setVideoUrl] = useState(post ? videoUrlFromPost(post) : "");
  // The optional Spotify playlist (migration 035). Stored as the bare
  // id; the edit form starts from the rebuilt canonical link.
  const [playlistLink, setPlaylistLink] = useState(
    post?.playlist_id ? buildPlaylistUrl(post.playlist_id) : ""
  );

  // The optionally tied release (full local row via /api/catalog/ensure).
  const [release, setRelease] = useState<Release | null>(initialRelease);
  const [pickedArtist, setPickedArtist] = useState(initialArtist);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // LANGUAGES: messages → posts.form (+ common).
  const t = useTranslations("posts.form");
  const tc = useTranslations("common");

  // Live video-URL feedback, recomputed every keystroke.
  const trimmedUrl = videoUrl.trim();
  const parsedVideo = trimmedUrl ? parseVideoUrl(trimmedUrl) : null;
  const isShortLink = trimmedUrl ? isTikTokShortLink(trimmedUrl) : false;
  const videoInvalid = trimmedUrl.length > 0 && !parsedVideo;

  // Live playlist-link feedback, same idea as the video field.
  const trimmedPlaylist = playlistLink.trim();
  const parsedPlaylist = trimmedPlaylist ? parsePlaylistUrl(trimmedPlaylist) : null;
  const playlistInvalid = trimmedPlaylist.length > 0 && !parsedPlaylist;

  const year = release?.release_date?.slice(0, 4) ?? null;

  function handlePick(pick: CatalogPick) {
    setRelease(pick.release);
    setPickedArtist(pick.artist_name);
  }

  // isPublished false = the Save as Draft path (same split as
  // ReviewForm): the post saves normally but only the author can see
  // it, and it waits on the My Stuff page to be published.
  async function handleSubmit(isPublished: boolean) {
    if (title.trim().length < 3) {
      setError(t("errors.title"));
      return;
    }
    if (body.trim().length === 0) {
      setError(t("errors.body"));
      return;
    }
    if (videoInvalid) {
      setError(t("errors.video"));
      return;
    }
    if (playlistInvalid) {
      setError(t("errors.playlist"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(editing ? `/api/posts/${post!.id}` : "/api/posts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body,
          video_url: trimmedUrl || null,
          playlist_url: trimmedPlaylist || null,
          release_id: release?.id ?? null,
          is_published: isPublished,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("errors.wentWrong"));
        setSaving(false);
        return;
      }

      const data = (await res.json()) as { post: Post };
      // Drafts live on the manage page (like review drafts); published
      // posts jump straight to their public page.
      router.push(isPublished ? `/posts/${data.post.slug}` : "/reviews/mine");
      router.refresh();
    } catch {
      setError(t("errors.network"));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ========== STEP 1: THE POST ========== */}
      <fieldset className="panel-xbox p-5 space-y-4">
        <legend className="label-xbox">{t("thePost")}</legend>

        <FormField label={t("titleLabel", { n: title.length })}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder={t("titlePlaceholder")}
            maxLength={120}
            className="form-input"
            autoFocus
          />
        </FormField>

        <FormField label={t("bodyLabel", { n: body.length, max: BODY_MAX })}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            placeholder={t("bodyPlaceholder")}
            rows={12}
            maxLength={BODY_MAX}
            className="form-input resize-none"
          />
        </FormField>
      </fieldset>

      {/* ========== STEP 2: THE VIDEO (optional) ========== */}
      <fieldset className="panel-xbox p-5 space-y-3">
        <legend className="label-xbox">{t("video")}</legend>

        <FormField label={t("videoLabel")}>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="youtube.com/watch?v=… or tiktok.com/@user/video/…"
            className="form-input"
          />
        </FormField>

        {/* Live parse feedback */}
        {parsedVideo && (
          <p className="pixel-text text-xs text-accent-primary">
            {t("videoDetected", { kind: parsedVideo.kind === "youtube" ? "YouTube" : "TikTok" })}
          </p>
        )}
        {isShortLink && (
          <p className="text-xs text-accent-rose">
            {t("shortLink")}
          </p>
        )}
        {videoInvalid && !isShortLink && (
          <p className="text-xs text-accent-rose">
            {t("videoInvalid")}
          </p>
        )}
        {!trimmedUrl && (
          <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
            {t("videoHint")}
          </p>
        )}
      </fieldset>

      {/* ========== STEP 2b: THE PLAYLIST (optional) ==========
          A Spotify playlist embeds on the post with its own player
          (Luca 2026-09-02), and readers can save it as one of their
          lists from there. Stored as the bare id — see lib/playlist.ts. */}
      <fieldset className="panel-xbox p-5 space-y-3">
        <legend className="label-xbox">{t("playlist")}</legend>

        <FormField label={t("playlistLabel")}>
          <input
            type="text"
            value={playlistLink}
            onChange={(e) => setPlaylistLink(e.target.value)}
            placeholder="open.spotify.com/playlist/…"
            className="form-input"
            spellCheck={false}
            autoComplete="off"
          />
        </FormField>

        {parsedPlaylist && (
          <p className="pixel-text text-xs text-accent-primary">
            {t("playlistDetected")}
          </p>
        )}
        {playlistInvalid && (
          <p className="text-xs text-accent-rose">
            {t("playlistInvalid")}
          </p>
        )}
        {!trimmedPlaylist && (
          <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
            {t("playlistHint")}
          </p>
        )}
      </fieldset>

      {/* ========== STEP 3: THE RELEASE (optional) ==========
          overflow-visible: this panel hosts the search dropdown —
          the panel's default overflow:hidden would clip the list. */}
      <fieldset className="panel-xbox overflow-visible p-5 space-y-4">
        <legend className="label-xbox">{t("tiedRelease")}</legend>

        {release ? (
          <div className="flex items-center gap-4 p-3 rounded-lg border border-[rgba(var(--accent-rgb),0.4)] bg-[rgba(var(--accent-rgb),0.08)]">
            {/* Locked-in cover */}
            <div className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 bg-bg-elevated shrink-0">
              {release.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={release.cover_image}
                  alt={tc("coverAlt", { title: release.title })}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-2xl">
                  💿
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-[family-name:var(--font-heading)] font-bold text-text-primary truncate">
                {release.title}
              </p>
              <p className="text-sm text-text-secondary truncate">
                {pickedArtist}
                {year ? ` · ${year}` : ""} · {release.release_type}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRelease(null)}
              className="label-xbox hover:text-accent-primary transition-colors text-[0.65rem] shrink-0"
            >
              {t("remove")}
            </button>
          </div>
        ) : (
          <CatalogSearch
            onPick={handlePick}
            placeholder={t("searchPlaceholder")}
          />
        )}

        <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
          {t("tieHint")}
        </p>
      </fieldset>

      {/* ========== ERROR ========== */}
      {error && (
        <div className="panel-xbox p-4 border-red-500/30 bg-red-500/5">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* ========== ACTIONS ========== */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={saving || title.trim().length < 3 || body.trim().length === 0}
          className="btn-y2k btn-y2k-primary disabled:opacity-50"
        >
          {saving
            ? editing
              ? t("saving")
              : t("posting")
            : editing
              ? post!.is_published === false
                ? t("updatePublish")
                : t("saveChanges")
              : t("publish")}
        </button>

        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={saving || title.trim().length < 3 || body.trim().length === 0}
          className="btn-y2k btn-y2k-outline disabled:opacity-50"
        >
          {saving ? t("saving") : t("saveDraft")}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="btn-y2k btn-y2k-outline"
        >
          {tc("cancel")}
        </button>
      </div>
    </div>
  );
}

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
