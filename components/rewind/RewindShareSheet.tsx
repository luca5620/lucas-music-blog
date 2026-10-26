"use client";

/**
 * RewindShareSheet — "Share your Rewind" from the last screen of
 * /rewind (Luca 2026-10-25). The year as one 9:16 card
 * (drawRewind in lib/share-cards/render.ts):
 *   - Share image: the still, through the phone's share sheet / a download.
 *   - Instagram / TikTok (app 1.3+, only the apps on this phone): a
 *     6-second clip of the same card (covers fade in, then it holds),
 *     straight into the story / TikTok editor — same plugin and same
 *     rules as the review share sheet.
 * Loaded lazily: none of this ships with /rewind until someone taps Share.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import SheetFrame from "@/components/share/SheetFrame";
import { InstagramLogo, TikTokLogo } from "@/components/share/SocialLogos";
import { loadCardAssets, loadImage } from "@/lib/share-cards/assets";
import {
  CARD_H,
  CARD_W,
  REWIND_CLIP,
  SCALE,
  drawRewind,
  type CardAssets,
  type RewindCardData,
} from "@/lib/share-cards/render";
import { canvasToPng, extFor, recordCanvas, shareOrSave } from "@/lib/share-cards/export";
import { hapticTap, socialSharePlugin, socialTargets, writeCacheFile } from "@/lib/native";

export interface RewindShareInput {
  year: number;
  handle: string;
  role: string | null;
  avatarUrl: string | null;
  covers: (string | null)[];
  stats: [string, string][];
  topLine: string | null;
  labels: { eyebrow: string; heading: string };
}

export default function RewindShareSheet({ input, onClose }: { input: RewindShareInput; onClose: () => void }) {
  const t = useTranslations("shareCards");
  const tr = useTranslations("rewind");
  const [assets, setAssets] = useState<CardAssets | null>(null);
  const [card, setCard] = useState<RewindCardData | null>(null);
  const [social, setSocial] = useState({ instagram: false, tiktok: false });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    socialTargets().then((s) => alive && setSocial(s));
    Promise.all([
      loadCardAssets({ avatarUrl: input.avatarUrl }),
      Promise.all(input.covers.slice(0, 9).map((c) => loadImage(c))),
    ]).then(([a, covers]) => {
      if (!alive) return;
      setAssets(a);
      setCard({
        handle: input.handle,
        role: input.role,
        covers,
        stats: input.stats,
        topLine: input.topLine,
        labels: input.labels,
      });
    });
    return () => {
      alive = false;
    };
  }, [input]);

  const drawAt = useCallback(
    (time: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !assets || !card) return;
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.clearRect(0, 0, CARD_W, CARD_H);
      drawRewind(ctx, assets, card, time);
    },
    [assets, card]
  );
  useEffect(() => drawAt(REWIND_CLIP), [drawAt]);

  const filename = `peak-music-rewind-${input.year}`;

  async function shareImage() {
    if (!canvasRef.current || !card) return;
    setBusy(true);
    setNote(null);
    hapticTap();
    try {
      drawAt(REWIND_CLIP);
      const png = await canvasToPng(canvasRef.current);
      const result = await shareOrSave(png, `${filename}.png`, tr("shareTitle"));
      if (result === "saved") setNote(t("saved"));
      if (result === "unsupported") setNote(t("imageNeedsUpdate"));
    } catch {
      setNote(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function sendSocial(target: "instagram" | "tiktok") {
    const plugin = socialSharePlugin();
    if (!plugin || !canvasRef.current || !card) return;
    const app = target === "instagram" ? "Instagram" : "TikTok";
    setBusy(true);
    setNote(null);
    hapticTap();
    try {
      setProgress(0);
      const video = await recordCanvas(canvasRef.current, drawAt, REWIND_CLIP, setProgress);
      setProgress(null);
      drawAt(REWIND_CLIP);
      const videoPath = await writeCacheFile(video, `${filename}.${extFor(video)}`);
      if (!videoPath) throw new Error("no-file");
      if (target === "instagram") await plugin.instagramStory({ videoPath });
      else await plugin.tiktok({ videoPath });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "NOT_INSTALLED") setNote(t("notInstalled", { app }));
      else if (code === "PHOTOS_DENIED") setNote(t("photosDenied"));
      else setNote(t("failed"));
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  const ready = !!assets && !!card;
  return (
    <SheetFrame title={tr("shareTitle")} closeLabel={t("close")} onClose={onClose}>
      <div className="share-stage">
        <canvas
          ref={canvasRef}
          width={CARD_W * SCALE}
          height={CARD_H * SCALE}
          className="share-canvas"
          aria-label={tr("shareTitle")}
        />
        {!ready && <p className="share-stage-wait">{t("preparing")}</p>}
        {progress !== null && (
          <p className="share-stage-wait">{Math.round(progress * 100)}%</p>
        )}
      </div>
      <div className="share-actions">
        <button
          type="button"
          className="btn-y2k btn-y2k-primary disabled:opacity-50"
          disabled={!ready || busy}
          onClick={shareImage}
        >
          {t("shareImage")}
        </button>
        {social.instagram && (
          <button
            type="button"
            className="share-logo-btn is-instagram"
            disabled={!ready || busy}
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
            disabled={!ready || busy}
            onClick={() => sendSocial("tiktok")}
            aria-label="TikTok"
            title="TikTok"
          >
            <TikTokLogo />
          </button>
        )}
      </div>
      {note && <p className="share-note">{note}</p>}
    </SheetFrame>
  );
}
