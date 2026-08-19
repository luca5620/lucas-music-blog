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

const BODY_MAX = 10000;

export default function PostForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  // The optionally tied release (full local row via /api/catalog/ensure).
  const [release, setRelease] = useState<Release | null>(null);
  const [pickedArtist, setPickedArtist] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live video-URL feedback, recomputed every keystroke.
  const trimmedUrl = videoUrl.trim();
  const parsedVideo = trimmedUrl ? parseVideoUrl(trimmedUrl) : null;
  const isShortLink = trimmedUrl ? isTikTokShortLink(trimmedUrl) : false;
  const videoInvalid = trimmedUrl.length > 0 && !parsedVideo;

  const year = release?.release_date?.slice(0, 4) ?? null;

  function handlePick(pick: CatalogPick) {
    setRelease(pick.release);
    setPickedArtist(pick.artist_name);
  }

  async function handleSubmit() {
    if (title.trim().length < 3) {
      setError("Give it a title — at least 3 characters.");
      return;
    }
    if (body.trim().length === 0) {
      setError("Write something — the body can't be empty.");
      return;
    }
    if (videoInvalid) {
      setError("Fix the video URL (or clear it) before posting.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body,
          video_url: trimmedUrl || null,
          release_id: release?.id ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong.");
        setSaving(false);
        return;
      }

      const data = (await res.json()) as { post: Post };
      router.push(`/posts/${data.post.slug}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ========== STEP 1: THE POST ========== */}
      <fieldset className="panel-xbox p-5 space-y-4">
        <legend className="label-xbox">The Post</legend>

        <FormField label={`Title (${title.length}/120)`}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="Name the thing…"
            maxLength={120}
            className="form-input"
            autoFocus
          />
        </FormField>

        <FormField label={`Body (${body.length}/${BODY_MAX})`}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            placeholder="Go long. The edit's backstory, the essay, the breakdown — whatever the record deserves."
            rows={12}
            maxLength={BODY_MAX}
            className="form-input resize-none"
          />
        </FormField>
      </fieldset>

      {/* ========== STEP 2: THE VIDEO (optional) ========== */}
      <fieldset className="panel-xbox p-5 space-y-3">
        <legend className="label-xbox">Video — optional</legend>

        <FormField label="YouTube or TikTok link">
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
          <p className="pixel-text text-xs text-osd-green">
            ✓ {parsedVideo.kind === "youtube" ? "YouTube" : "TikTok"} video
            detected — it&apos;ll embed on your post.
          </p>
        )}
        {isShortLink && (
          <p className="text-xs text-accent-rose">
            vm.tiktok.com share links can&apos;t be embedded — open the link
            in your browser and paste the full
            tiktok.com/@user/video/… URL instead.
          </p>
        )}
        {videoInvalid && !isShortLink && (
          <p className="text-xs text-accent-rose">
            Not a recognized video link. Paste a youtube.com/watch, youtu.be,
            YouTube Shorts, or tiktok.com/@user/video URL.
          </p>
        )}
        {!trimmedUrl && (
          <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
            one video max — AMV edits, live cuts, video essays all welcome
          </p>
        )}
      </fieldset>

      {/* ========== STEP 3: THE RELEASE (optional) ==========
          overflow-visible: this panel hosts the search dropdown —
          the panel's default overflow:hidden would clip the list. */}
      <fieldset className="panel-xbox overflow-visible p-5 space-y-4">
        <legend className="label-xbox">Tied Release — optional</legend>

        {release ? (
          <div className="flex items-center gap-4 p-3 rounded-lg border border-[rgba(var(--accent-rgb),0.4)] bg-[rgba(var(--accent-rgb),0.08)]">
            {/* Locked-in cover */}
            <div className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 bg-bg-elevated shrink-0">
              {release.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={release.cover_image}
                  alt={`${release.title} cover`}
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
              Remove
            </button>
          </div>
        ) : (
          <CatalogSearch
            onPick={handlePick}
            placeholder="Search the song or album this post is about…"
          />
        )}

        <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
          tie your post to the record it&apos;s about — readers can jump
          straight from your post to the release page
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
          onClick={handleSubmit}
          disabled={saving || title.trim().length < 3 || body.trim().length === 0}
          className="btn-y2k btn-y2k-primary disabled:opacity-50"
        >
          {saving ? "Posting…" : "Publish Post"}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="btn-y2k btn-y2k-outline"
        >
          Cancel
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
