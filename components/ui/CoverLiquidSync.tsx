"use client";

/**
 * CoverLiquidSync — recolors the site-wide liquid light to match an
 * album cover (Luca 2026-08-25: "the color blobs and lighting should
 * make the color scheme of what's on the album cover").
 *
 * Same bridge as ThemeLiquidSync on profiles: the liquid layers read
 * --liquid-1/2/3 from <html>, so pushing three RGB triplets up there
 * recolors the wash everywhere — web's drifting blobs and the app's
 * still gradients alike. Colors reset when you leave the page.
 *
 * How the trio is found: the cover is drawn onto a tiny 32×32 canvas
 * and its pixels are bucketed into coarse color families; the three
 * most common families that are (a) not near-black, and (b) far
 * enough from each other to read as distinct, win. Each winner is
 * then brightened so it glows over the true-black canvas — a muted
 * navy on the sleeve should still light the room navy.
 *
 * Fails soft by design: Spotify's CDN sends CORS headers so canvas
 * sampling works; if a host doesn't (some Genius images), reading
 * pixels throws and we simply leave the default sage/amber/oxblood
 * in place.
 */

import { useEffect } from "react";

/** Only https:// or local /path images (same rule as safeImage). */
function safeUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

/** Extract up to three dominant, mutually-distinct colors. */
function extractTrio(img: HTMLImageElement): string[] | null {
  const SIZE = 32;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);

  let data: Uint8ClampedArray;
  try {
    // Throws on CORS-tainted canvases — the fail-soft path.
    data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  } catch {
    return null;
  }

  // Bucket pixels by coarse color (3 bits per channel = 512 families),
  // remembering each family's average color and population.
  const buckets = new Map<
    number,
    { r: number; g: number; b: number; n: number }
  >();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Near-black pixels can't glow — skip them. (Near-white is kept:
    // a white glow on black looks like stage light, which is fine.)
    if (Math.max(r, g, b) < 40) continue;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    buckets.set(key, bucket);
  }
  if (buckets.size === 0) return null;

  // Most-common first; saturated families get a head start so a gray
  // sleeve with one red stripe still lights the room red.
  const ranked = [...buckets.values()]
    .map(({ r, g, b, n }) => {
      const avg = { r: r / n, g: g / n, b: b / n };
      const sat =
        (Math.max(avg.r, avg.g, avg.b) - Math.min(avg.r, avg.g, avg.b)) / 255;
      return { ...avg, score: n * (1 + sat * 2) };
    })
    .sort((a, b) => b.score - a.score);

  // Greedy pick: take the best, then the best sufficiently far from
  // everything taken (so we get three COLORS, not three shades).
  const picked: { r: number; g: number; b: number }[] = [];
  for (const minDist of [90, 45, 0]) {
    for (const c of ranked) {
      if (picked.length === 3) break;
      const farEnough = picked.every(
        (p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) >= minDist
      );
      if (farEnough) picked.push(c);
    }
    if (picked.length === 3) break;
  }

  // Brighten each pick so it reads as light, not pigment: scale the
  // strongest channel up to ~220 (capped at 3× so black-ish picks
  // don't blow out into noise).
  return picked.map((c) => {
    const max = Math.max(c.r, c.g, c.b, 1);
    const scale = Math.min(220 / max, 3);
    const r = Math.round(Math.min(255, c.r * scale));
    const g = Math.round(Math.min(255, c.g * scale));
    const b = Math.round(Math.min(255, c.b * scale));
    return `${r}, ${g}, ${b}`;
  });
}

export default function CoverLiquidSync({
  coverUrl,
}: {
  coverUrl: string | null;
}) {
  useEffect(() => {
    const url = safeUrl(coverUrl);
    if (!url) return;

    const root = document.documentElement;
    let cancelled = false;

    const img = new Image();
    // Asks the CDN for CORS headers so the canvas stays readable.
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      if (cancelled) return;
      const trio = extractTrio(img);
      if (!trio || trio.length === 0) return;
      root.style.setProperty("--liquid-1", trio[0]);
      root.style.setProperty("--liquid-2", trio[1] ?? trio[0]);
      root.style.setProperty("--liquid-3", trio[2] ?? trio[0]);
    };
    // onerror: no CORS / broken image — defaults stay, nothing to do.

    return () => {
      cancelled = true;
      root.style.removeProperty("--liquid-1");
      root.style.removeProperty("--liquid-2");
      root.style.removeProperty("--liquid-3");
    };
  }, [coverUrl]);

  return null;
}
