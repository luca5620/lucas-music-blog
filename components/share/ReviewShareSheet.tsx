"use client";

/**
 * ReviewShareSheet — what "Share" opens on a finished review (Luca
 * 2026-10-24: share cards are his top priority, "basically free
 * marketing"). Three choices:
 *
 *   - Scorecard video: the record, every song score rolling in, the
 *     album score landing, then an 8-second hold. Plays here as the
 *     preview; tapping Share records it off the same canvas.
 *   - Sticker: the see-through glass sticker as a transparent PNG.
 *   - Link: the review page itself (the old Share button's job).
 *
 * ONE-TAP INSTAGRAM STORY + TIKTOK (2026-10-25, app build 1.3+ only —
 * ios/App/App/SocialSharePlugin.swift, docs/ONE-TAP-SHARE-SETUP.md):
 *   - Scorecard tab: the video goes straight in as the story / TikTok.
 *   - Sticker tab: they pick their own clip, and the sticker lands on
 *     top (a real movable sticker in Instagram; glued on for TikTok,
 *     which has no sticker layer for other apps).
 * The buttons only appear when the installed app has the plugin AND
 * that app is on the phone; everyone else keeps the normal Share.
 *
 * The drawings live in lib/share-cards/render.ts, the file hand-off in
 * lib/share-cards/export.ts. Loaded lazily — none of this code ships
 * with the review page until someone taps Share.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import SheetFrame from "@/components/share/SheetFrame";
import { loadCardAssets } from "@/lib/share-cards/assets";
import {
  CARD_H,
  CARD_W,
  SCALE,
  STICKER_LOOP,
  drawScorecard,
  drawSticker,
  drawStickerPreview,
  scorecardDuration,
  stickerSize,
  type CardAssets,
  type ScorecardData,
  type StickerData,
} from "@/lib/share-cards/render";
import { canRecordVideo, canvasToPng, extFor, recordCanvas, shareOrSave, type HandOff } from "@/lib/share-cards/export";
import { InstagramLogo, TikTokLogo } from "@/components/share/SocialLogos";
import { hapticTap, isNativeApp, shareLink, socialSharePlugin, socialTargets, writeCacheFile } from "@/lib/native";

/** "r, g, b" (a palette entry from assets.ts) → "#rrggbb", optionally darker. */
function rgbToHex(rgb: string | undefined, darken = 0): string {
  const parts = (rgb ?? "").split(",").map((n) => Number(n.trim()));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return "#0f1015";
  return (
    "#" +
    parts
      .slice(0, 3)
      .map((n) => Math.round(n * (1 - darken)).toString(16).padStart(2, "0"))
      .join("")
  );
}

export interface ReviewCard {
  title: string;
  artist: string;
  year: string | null;
  /** "Album", "Single", … already capitalised */
  typeLabel: string | null;
  rating: number;
  handle: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  quote: string | null;
  songs: { n: number; title: string; score: number }[];
  url: string;
  shareTitle: string;
  slug: string;
}

type Tab = "scorecard" | "sticker" | "link";

export default function ReviewShareSheet({ card, onClose }: { card: ReviewCard; onClose: () => void }) {
  const t = useTranslations("shareCards");
  const [tab, setTab] = useState<Tab>("scorecard");
  const [assets, setAssets] = useState<CardAssets | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The last finished video, so "Share" again doesn't re-record.
  const videoRef = useRef<Blob | null>(null);
  const recording = useRef(false);
  // True once the video is recorded and waiting for its Share tap.
  const [videoReady, setVideoReady] = useState(false);
  const videoOk = useMemo(() => canRecordVideo(), []);
  // Which one-tap targets this phone has (both false on the web and on
  // app builds without the plugin).
  const [social, setSocial] = useState({ instagram: false, tiktok: false });
  useEffect(() => {
    let alive = true;
    socialTargets().then((s) => alive && setSocial(s));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    loadCardAssets({ coverUrl: card.coverUrl, avatarUrl: card.avatarUrl }).then((a) => alive && setAssets(a));
    return () => {
      alive = false;
    };
  }, [card.coverUrl, card.avatarUrl]);

  const scorecard: ScorecardData = useMemo(
    () => ({
      title: card.title,
      subtitle: [card.artist, card.year].filter(Boolean).join(" · "),
      rating: card.rating,
      handle: card.handle,
      songs: card.songs,
      quote: card.quote,
      labels: {
        songsProgress: (done, total) => t("songsProgress", { done, total }),
        outOf: t("outOfShort"),
        more: (n) => t("more", { n }),
      },
    }),
    [card, t]
  );
  const sticker: StickerData = useMemo(
    () => ({
      title: card.title,
      subtitle: [card.artist, card.typeLabel].filter(Boolean).join(" · "),
      rating: card.rating,
      handle: card.handle,
      quote: card.quote,
      labels: { outOf: t("outOf") },
    }),
    [card, t]
  );
  const duration = scorecardDuration(scorecard);

  /** Draw one frame of the current tab at time `time`. */
  const draw = useCallback(
    (time: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !assets) return;
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.clearRect(0, 0, CARD_W, CARD_H);
      if (tab === "scorecard") drawScorecard(ctx, assets, scorecard, time);
      else drawStickerPreview(ctx, assets, sticker, time);
    },
    [assets, tab, scorecard, sticker]
  );

  // The live preview: loops the scorecard (or the sticker's swirl).
  useEffect(() => {
    if (!assets || tab === "link") return;
    let raf = 0;
    const start = performance.now();
    const loop = tab === "scorecard" ? duration + 0.6 : STICKER_LOOP;
    const tick = () => {
      if (!recording.current) draw(((performance.now() - start) / 1000) % loop);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [assets, tab, draw, duration]);

  /**
   * Older app builds (before 1.3) can't save a file at all, and the app
   * has iOS's press-and-hold image menu switched off — the old "press
   * and hold this image" fallback did nothing there and only got the
   * image highlighted (Luca 2026-10-24). So it just says so plainly.
   */
  function report(result: HandOff, isVideo: boolean) {
    if (result === "saved") setNote(t("saved"));
    else if (result === "unsupported") setNote(isVideo ? t("videoNeedsUpdate") : t("imageNeedsUpdate"));
    else setNote(null);
  }

  /** Final frame as a PNG — the fallback when video can't be made/saved. */
  async function scorecardStill(): Promise<Blob | null> {
    if (!canvasRef.current) return null;
    recording.current = true;
    draw(duration);
    const png = await canvasToPng(canvasRef.current).catch(() => null);
    recording.current = false;
    return png;
  }

  /** Record the scorecard once and keep it (Share / Instagram / TikTok reuse it). */
  async function ensureVideo(): Promise<Blob> {
    if (videoRef.current) return videoRef.current;
    recording.current = true;
    setProgress(0);
    try {
      videoRef.current = await recordCanvas(canvasRef.current!, draw, duration, setProgress);
    } finally {
      recording.current = false;
    }
    setVideoReady(true);
    return videoRef.current;
  }

  /** What went wrong in a one-tap hand-off, in words. */
  function socialError(e: unknown, app: string) {
    const code = (e as { code?: string })?.code;
    if (code === "NOT_INSTALLED") setNote(t("notInstalled", { app }));
    else if (code === "PHOTOS_DENIED") setNote(t("photosDenied"));
    else setNote(t("failed"));
  }

  /**
   * One tap to Instagram's story editor or TikTok's. Scorecard tab: the
   * video itself. Sticker tab: the native side opens the photo picker
   * for their own clip and puts the sticker on top.
   */
  async function sendSocial(target: "instagram" | "tiktok") {
    const plugin = socialSharePlugin();
    if (!plugin || !assets || !canvasRef.current) return;
    const app = target === "instagram" ? "Instagram" : "TikTok";
    setBusy(true);
    setNote(null);
    hapticTap();
    try {
      if (tab === "scorecard") {
        const video = await ensureVideo();
        const videoPath = await writeCacheFile(video, `peak-music-${card.slug}.${extFor(video)}`);
        if (!videoPath) throw new Error("no-file");
        if (target === "instagram") await plugin.instagramStory({ videoPath });
        else await plugin.tiktok({ videoPath });
      } else {
        const stickerPath = await writeCacheFile(await stickerPng(), `peak-music-sticker-${card.slug}.png`);
        if (!stickerPath) throw new Error("no-file");
        if (target === "instagram") {
          await plugin.instagramStory({
            stickerPath,
            pickBackground: true,
            topColor: rgbToHex(assets.palette[0]),
            bottomColor: rgbToHex(assets.palette[1] ?? assets.palette[0], 0.5),
          });
        } else {
          await plugin.tiktok({ stickerPath, pickBackground: true });
        }
      }
    } catch (e) {
      socialError(e, app);
    } finally {
      setBusy(false);
    }
  }

  async function shareScorecard() {
    if (!canvasRef.current || !assets) return;
    setBusy(true);
    setNote(null);
    hapticTap();
    const base = `peak-music-${card.slug}`;
    try {
      if (!videoOk) {
        const still = await scorecardStill();
        setNote(t("noVideo"));
        if (still) report(await shareOrSave(still, `${base}.png`, card.shareTitle), false);
        return;
      }
      if (!videoRef.current) {
        await ensureVideo();
        // Browsers only open the share sheet right after a tap, and the
        // ~16s recording used that tap up — so on the web the button
        // turns into "Share video" for a second, fresh tap. The app's
        // native share has no such rule and goes straight on.
        if (!isNativeApp()) return;
      }
      const video = await ensureVideo();
      const result = await shareOrSave(video, `${base}.${extFor(video)}`, card.shareTitle);
      report(result, true);
    } catch {
      setNote(t("failed"));
    } finally {
      recording.current = false;
      setBusy(false);
    }
  }

  /** The sticker alone, on transparent pixels, with room for its shadow. */
  function stickerPng(): Promise<Blob> {
    const off = document.createElement("canvas");
    const probe = off.getContext("2d")!;
    const { w, h } = stickerSize(probe, assets!, sticker);
    off.width = (w + 40) * SCALE;
    off.height = (h + 56) * SCALE;
    const ctx = off.getContext("2d")!;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    drawSticker(ctx, assets!, sticker, 1.2, 20, 16);
    return canvasToPng(off);
  }

  async function shareSticker() {
    if (!assets) return;
    setBusy(true);
    setNote(null);
    hapticTap();
    try {
      const png = await stickerPng();
      report(await shareOrSave(png, `peak-music-sticker-${card.slug}.png`, card.shareTitle), false);
    } catch {
      setNote(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * "Copy sticker" — how a sticker ends up on top of someone's own
   * video (Luca 2026-10-24: mirror how the reference app's sticker
   * lands on reaction videos, which are Instagram stories). The
   * see-through PNG goes on the clipboard; in Instagram they film or
   * pick their clip, then paste and it drops in as a movable sticker.
   * Works on the website and in today's app — no new build needed.
   * The ClipboardItem gets the PNG as a promise so the copy still
   * counts as part of the tap (Safari's rule).
   */
  const canCopyImage =
    typeof window !== "undefined" && typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;
  function copySticker() {
    if (!assets) return;
    setNote(null);
    hapticTap();
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": stickerPng() })])
      .then(() => setNote(t("stickerCopied")))
      .catch(() => setNote(t("failed")));
  }

  const left = Math.max(0, Math.ceil(duration * (1 - progress)));

  return (
    <SheetFrame title={t("title")} closeLabel={t("close")} onClose={onClose}>
      <div className="rate-seg share-tabs" role="radiogroup" aria-label={t("tabsAria")}>
        {(["scorecard", "sticker", "link"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={tab === k}
            className={tab === k ? "is-on" : ""}
            disabled={busy}
            onClick={() => {
              setTab(k);
              setNote(null);
            }}
          >
            {t(k)}
          </button>
        ))}
      </div>

      {/* keyed by tab: each tab's content fades in when you switch
          (the sheet's height glides in SheetFrame) */}
      {tab !== "link" ? (
        <div key={tab} className="share-swap">
          <div className="share-stage">
            <canvas
              ref={canvasRef}
              width={CARD_W * SCALE}
              height={CARD_H * SCALE}
              className="share-canvas"
              aria-label={tab === "scorecard" ? t("scorecard") : t("sticker")}
            />
            {!assets && <p className="share-stage-wait">{t("preparing")}</p>}
          </div>
          <p className="share-hint">
            {tab === "scorecard" ? t("scorecardHint", { s: Math.round(duration) }) : t("stickerHint")}
          </p>
          {busy && tab === "scorecard" && videoOk && (
            <div className="share-progress" aria-live="polite">
              <div className="rate-progress">
                <i style={{ width: `${progress * 100}%` }} />
              </div>
              <span>{t("making", { s: left })}</span>
            </div>
          )}
          <div className="share-actions">
            <button
              type="button"
              className="btn-y2k btn-y2k-primary disabled:opacity-50"
              disabled={!assets || busy}
              onClick={tab === "scorecard" ? shareScorecard : shareSticker}
            >
              {tab === "scorecard"
                ? !videoOk
                  ? t("shareImage")
                  : videoReady
                    ? t("shareVideo")
                    : t("makeVideo")
                : t("shareSticker")}
            </button>
            {/* One-tap targets (app 1.3+, only the apps on this phone),
                as round logo buttons (Luca 2026-10-25). The name stays
                as the aria-label + tooltip for screen readers. */}
            {social.instagram && (
              <button
                type="button"
                className="share-logo-btn is-instagram"
                disabled={!assets || busy || (tab === "scorecard" && !videoOk)}
                onClick={() => sendSocial("instagram")}
                aria-label={t("instagramStory")}
                title={t("instagramStory")}
              >
                <InstagramLogo />
              </button>
            )}
            {social.tiktok && (
              <button
                type="button"
                className="share-logo-btn is-tiktok"
                disabled={!assets || busy || (tab === "scorecard" && !videoOk)}
                onClick={() => sendSocial("tiktok")}
                aria-label="TikTok"
                title="TikTok"
              >
                <TikTokLogo />
              </button>
            )}
            {tab === "sticker" && canCopyImage && (
              <button
                type="button"
                className="btn-y2k btn-y2k-outline disabled:opacity-50"
                disabled={!assets || busy}
                onClick={copySticker}
              >
                {t("copySticker")}
              </button>
            )}
          </div>
          {tab === "sticker" && (social.instagram || social.tiktok) && (
            <p className="share-hint">{t("pickClipHint")}</p>
          )}
        </div>
      ) : (
        <div key="link" className="share-swap">
          <p className="share-hint">{t("linkHint")}</p>
          <div className="share-actions">
            <button
              type="button"
              className="btn-y2k btn-y2k-primary"
              onClick={() => {
                hapticTap();
                shareLink(card.shareTitle, card.url);
              }}
            >
              {t("shareLink")}
            </button>
            <button
              type="button"
              className="btn-y2k btn-y2k-outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(card.url);
                  setNote(t("copied"));
                } catch {
                  /* no clipboard (old WebView) — the share button still works */
                }
              }}
            >
              {t("copyLink")}
            </button>
          </div>
        </div>
      )}

      {note && <p className="share-note">{note}</p>}
    </SheetFrame>
  );
}
