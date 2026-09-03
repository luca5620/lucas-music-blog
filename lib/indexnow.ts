/**
 * IndexNow — tell Bing (and Yandex, Seznam, Naver; they share the
 * protocol) about a new or changed page the moment it exists, instead
 * of waiting for the crawler to find it in the sitemap weeks later.
 *
 * WHY THIS MATTERS FOR US (docs/AI-SEARCH.md): ChatGPT's live web
 * search runs on Bing. A release page or review that Bing has never
 * indexed can't be in a ChatGPT answer. Google has its own cadence
 * and ignores IndexNow, so this is purely the Bing lever.
 *
 * HOW IT WORKS: one POST to api.indexnow.org with the host, our key,
 * and up to 10,000 URLs. Bing proves we own the key by fetching
 * https://peakmusicreviews.com/<key>.txt, which the rewrite in
 * next.config.ts serves from /api/indexnow/key. The key itself lives
 * in the INDEXNOW_KEY env var (Vercel); without it every call here is
 * a silent no-op, so nothing breaks on a machine that doesn't have it.
 *
 * FIRE AND FORGET: the write routes call this AFTER their own work is
 * done and never await the result beyond a short timeout — a slow or
 * failing IndexNow must never slow down or fail a review post. Errors
 * are logged, not thrown.
 */

const HOST = "peakmusicreviews.com";
const ENDPOINT = "https://api.indexnow.org/indexnow";
/** Bing's own key format: 8–128 hex/alphanumeric characters. */
const KEY_SHAPE = /^[a-zA-Z0-9-]{8,128}$/;

/** The configured key, or null when IndexNow is off for this deploy. */
export function indexNowKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim();
  return key && KEY_SHAPE.test(key) ? key : null;
}

/**
 * Ping IndexNow with site-relative paths ("/releases/foo"). Absolute
 * URLs on our host are accepted too; anything else is dropped.
 * Resolves quickly either way — callers don't need to await it.
 */
export async function pingIndexNow(paths: string[]): Promise<void> {
  const key = indexNowKey();
  if (!key) return;

  const urlList = [
    ...new Set(
      paths
        .map((p) => (p.startsWith("http") ? p : `https://${HOST}${p}`))
        .filter((u) => u.startsWith(`https://${HOST}/`))
    ),
  ];
  if (urlList.length === 0) return;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: `https://${HOST}/${key}.txt`,
        urlList,
      }),
      // A hung IndexNow must not hold a request open.
      signal: AbortSignal.timeout(4000),
    });
    // 200 = accepted, 202 = accepted (key not yet verified — normal on
    // the first pings after setup). Anything else is worth a log line.
    if (res.status !== 200 && res.status !== 202) {
      console.warn(`IndexNow answered ${res.status} for ${urlList.length} url(s)`);
    }
  } catch (err) {
    console.warn("IndexNow ping failed:", err instanceof Error ? err.message : err);
  }
}
