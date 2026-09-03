/**
 * GET /api/indexnow/key — the IndexNow ownership proof.
 *
 * Bing verifies an IndexNow submission by fetching
 * https://peakmusicreviews.com/<key>.txt and expecting the file to
 * contain exactly the key. next.config.ts rewrites that path here
 * (the key is an env var, so it can't be a committed public file —
 * committing it would put it on GitHub). Serves plain text, cached
 * for a day. 404 when IndexNow isn't configured for this deploy.
 *
 * Read-only, no session, no rate limit needed: the response is a
 * public constant by design.
 */

import { indexNowKey } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = indexNowKey();
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
