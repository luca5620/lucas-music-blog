import Link from "next/link";
import type { Metadata } from "next";

/**
 * The 404 page — and the note on WHY the site's notFound() calls live
 * where they do.
 *
 * The root `app/loading.tsx` is a streaming boundary: the moment a
 * navigation starts, Next.js commits the HTTP response (status 200)
 * and flushes the TUNING… shell, THEN renders the page. So a
 * notFound() in a page body arrives after the status is already sent
 * — the visitor sees a 404 page, but Google sees HTTP 200 with
 * not-found content, which is a soft 404. Left alone that quietly
 * feeds the index every deleted review, every mistyped handle, every
 * release slug that never existed.
 *
 * Metadata resolves BEFORE the shell is flushed (it has to — it fills
 * <head>), so a notFound() in generateMetadata sets a real 404. That
 * is why every dynamic route does its existence check up there and
 * the page body's notFound() is now only a backstop. The same trick
 * is what makes the dead-review 308 in /reviews/[slug] work.
 *
 * Keep the loading.tsx: instant tap feedback was the single worst
 * mobile feel-issue and this fix doesn't cost it.
 */

export const metadata: Metadata = {
  title: "Not Found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center"
      role="alert"
    >
      {/* Same voice as the app's NO SIGNAL screen — this is the other
          way the picture goes away. */}
      <p
        className="pixel-text text-3xl"
        style={{
          color: "#1e90ff",
          textShadow:
            "0 0 8px rgba(30,144,255,0.8), 0 0 24px rgba(30,144,255,0.35)",
        }}
      >
        NOT FOUND
      </p>

      <p className="text-sm text-text-secondary max-w-sm">
        There's nothing at this address. It may have been deleted, or the
        link that brought you here is wrong.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        <Link href="/" className="btn-y2k btn-y2k-primary">
          Home
        </Link>
        <Link href="/releases" className="btn-y2k btn-y2k-outline">
          Browse releases
        </Link>
        <Link href="/search" className="btn-y2k btn-y2k-outline">
          Search
        </Link>
      </div>
    </div>
  );
}
