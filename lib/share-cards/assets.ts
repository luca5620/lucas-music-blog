/**
 * Share cards — loading what the canvas needs (images, fonts, the
 * cover's colours) before the first frame is drawn.
 *
 * Images load with crossOrigin="anonymous": a canvas that has drawn a
 * cross-site image WITHOUT permission becomes "tainted" and refuses to
 * export, so every image must come from a host that sends CORS
 * headers. Checked 2026-10-24: Spotify's CDN (i.scdn.co), Genius
 * (images.genius.com) and Supabase storage (avatars) all send
 * `Access-Control-Allow-Origin: *`. Anything that doesn't simply loads
 * as null and the card draws a plain placeholder instead — a card with
 * a blank cover beats no card.
 */

import { extractTrio } from "@/components/ui/CoverLiquidSync";
import { DEFAULT_PALETTE, type CardAssets } from "@/lib/share-cards/render";

/** Only https:// or local /path images (same rule as safeImage). */
function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

/** Load an image for canvas use; resolves null on any failure (8s cap). */
export function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  const src = safeUrl(url);
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const timer = window.setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/** The site's Inter (a next/font variable on <html>), for canvas text. */
function sansFamily(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-inter").trim();
  return v ? `${v}, system-ui, sans-serif` : "Inter, system-ui, sans-serif";
}

/** Darken an "r, g, b" triplet (the scorecard liquid wants a deep 4th colour). */
function darken(rgb: string, k: number) {
  return rgb
    .split(",")
    .map((c) => Math.round(parseInt(c, 10) * k))
    .join(", ");
}

let fontsReady: Promise<void> | null = null;

/** Make sure the canvas fonts are actually downloaded before drawing. */
function loadFonts(sans: string): Promise<void> {
  if (!fontsReady) {
    fontsReady = Promise.all([
      document.fonts.load("14px PlayStation"),
      document.fonts.load(`400 14px ${sans}`),
      document.fonts.load(`600 14px ${sans}`),
      document.fonts.load(`700 14px ${sans}`),
      document.fonts.load(`800 14px ${sans}`),
    ])
      .then(() => undefined)
      .catch(() => undefined);
  }
  return fontsReady;
}

export async function loadCardAssets(opts: { coverUrl?: string | null; avatarUrl?: string | null }): Promise<CardAssets> {
  const sans = sansFamily();
  const [cover, avatar, penguin] = await Promise.all([
    loadImage(opts.coverUrl),
    loadImage(opts.avatarUrl),
    loadImage("/penguin/mark-192.webp"),
    loadFonts(sans),
  ]);
  let palette = DEFAULT_PALETTE;
  if (cover) {
    try {
      const trio = extractTrio(cover);
      if (trio && trio.length) palette = trio;
    } catch {
      /* tainted or unreadable — keep the default colours */
    }
  }
  if (palette.length < 4) palette = [...palette, darken(palette[0], 0.45)];
  return { cover, avatar, penguin, palette, sans, brand: "PlayStation, sans-serif" };
}
