/**
 * PlaylistEmbed — Spotify's official playlist player, framed like the
 * release-page preview card, plus the "save as a list" door.
 *
 * Server component: the iframe src is built from a fixed template +
 * the validated 22-char id (lib/playlist.ts) — the pasted URL never
 * reaches the page. next.config.ts CSP frame-src already allows
 * open.spotify.com. Logged-out visitors get 30s clips; anyone logged
 * into Spotify in the same browser plays full tracks.
 *
 * Used on: post pages (the post's playlist) and profiles (the
 * featured playlist).
 */

import { playlistEmbedSrc, playlistUrl } from "@/lib/playlist";
import SaveAsListButton from "./SaveAsListButton";
import { getTranslations } from "next-intl/server";

export default async function PlaylistEmbed({
  playlistId,
  title,
  label,
  /** Hide the save door where it makes no sense (the owner's own
      profile settings preview, say). Default on. */
  allowSave = true,
  /** 352 shows the tracklist; 152 is Spotify's compact bar. */
  height = 352,
}: {
  playlistId: string;
  title: string;
  label?: string;
  allowSave?: boolean;
  height?: 152 | 352;
}) {
  const t = await getTranslations("profile.playlist");
  return (
    <div className="card-y2k p-4 sm:p-5 space-y-3 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">{label ?? t("label")}</span>
        </div>
        <a
          href={playlistUrl(playlistId)}
          target="_blank"
          rel="noopener noreferrer"
          className="pixel-text text-[10px] text-text-muted hover:text-accent-primary uppercase tracking-widest transition-colors"
        >
          {t("openOnSpotify")}
        </a>
      </div>
      <iframe
        src={playlistEmbedSrc(playlistId)}
        width="100%"
        height={height}
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        title={t("iframeTitle", { title })}
        className="rounded-lg"
      />
      {allowSave && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
            {t("saveHint")}
          </p>
          <SaveAsListButton playlistId={playlistId} />
        </div>
      )}
    </div>
  );
}
