/**
 * GIFs (2026-10-11) — one shared shape for reviews and comments.
 *
 * WHERE THEY COME FROM: KLIPY (klipy.com), the GIF library Discord
 * and WhatsApp moved to when Google shut down the Tenor API on
 * 2026-06-30. Nothing is ever uploaded to us — we keep only the link
 * KLIPY hands back plus the GIF's size.
 *
 * KLIPY'S RULES (docs.klipy.com, "Integration Requirements") shape
 * how this works, so they're worth knowing before changing anything:
 *  - Search requests go from the member's own browser/app straight to
 *    api.klipy.com. No proxying through our server without their
 *    written OK — that's why the picker calls KLIPY directly and the
 *    app key is a NEXT_PUBLIC_ one (it's a public key by design, the
 *    same way Tenor's was).
 *  - Media loads straight from the URL they gave us, unmodified.
 *    Never copy, re-host or rewrite it.
 *  - Results are shown in the order KLIPY returns them. Filtering is
 *    configured in the KLIPY Partner Panel, plus the content_filter
 *    level we send with every request (see GIF_CONTENT_FILTER).
 *  - The search box says "Search KLIPY" (REQUIRED). A "Powered by
 *    KLIPY" mark is OPTIONAL — we keep it in the picker only; shown
 *    GIFs carry no mark (Luca 2026-10-11).
 *
 * Everything that touches the network lives in GifPicker. This file
 * is just the shape, the validator the API routes use, and the
 * pieces both sides need to agree on.
 */

/** A GIF as it's stored on a review or comment row. */
export interface Gif {
  url: string;
  width: number;
  height: number;
}

/** The public KLIPY app key. Unset = the GIF button simply doesn't
 *  render anywhere (the feature is invisible until Luca adds the key
 *  on Vercel — see docs/GIFS.md). */
export const KLIPY_APP_KEY = process.env.NEXT_PUBLIC_KLIPY_APP_KEY ?? "";

/** KLIPY's API base. The CSP in next.config.ts allows exactly this
 *  host in connect-src. */
export const KLIPY_API = "https://api.klipy.com/api/v1";

/**
 * How strict KLIPY's own content filter is: off | low | medium | high.
 * "high" is the strictest (MPA-style "G"-ish: no profanity, violence,
 * sexual content or substance use). App Store guideline 1.2 is why we
 * start strict — loosen to "medium" here if it turns out too tame.
 */
export const GIF_CONTENT_FILTER = "high";

/**
 * KLIPY media hosts: static.klipy.com, static1.klipy.com, … Must stay
 * in step with the CHECK constraint in migration 058 — the database
 * enforces the same pattern on every row.
 */
const KLIPY_MEDIA_RE =
  /^https:\/\/static[0-9]*\.klipy\.com\/[A-Za-z0-9/_.~%?&=-]+$/;

/**
 * Validate a GIF that arrived in a request body. Every field is
 * untrusted.
 *  - undefined / null → `null` (no GIF — a perfectly normal answer)
 *  - a valid GIF      → the cleaned-up Gif
 *  - anything else    → `false` (the route answers 400)
 */
export function parseGif(value: unknown): Gif | null | false {
  if (value == null) return null;
  if (typeof value !== "object") return false;
  const { url, width, height } = value as {
    url?: unknown;
    width?: unknown;
    height?: unknown;
  };
  if (typeof url !== "string" || url.length > 500 || !KLIPY_MEDIA_RE.test(url)) {
    return false;
  }
  const w = Number(width);
  const h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h)) return false;
  if (w < 1 || w > 4000 || h < 1 || h > 4000) return false;
  return { url, width: w, height: h };
}

/** Row columns → Gif (or null when the row has none). */
export function gifFromRow(row: {
  gif_url?: string | null;
  gif_width?: number | null;
  gif_height?: number | null;
}): Gif | null {
  if (!row.gif_url || !row.gif_width || !row.gif_height) return null;
  return { url: row.gif_url, width: row.gif_width, height: row.gif_height };
}

/** Gif (or null) → the three row columns, for inserts/updates. */
export function gifToRow(gif: Gif | null) {
  return {
    gif_url: gif?.url ?? null,
    gif_width: gif?.width ?? null,
    gif_height: gif?.height ?? null,
  };
}
