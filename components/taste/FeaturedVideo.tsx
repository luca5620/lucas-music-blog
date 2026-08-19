/**
 * FeaturedVideo — the video slot on Your Taste.
 *
 * TEST SEED (2026-08-19): the page hardcodes Luca's pick and every user
 * sees the same one. The plan: the Your Taste algorithm eventually fills
 * this slot (and the rest of the feed — posts, debates, reviews) per
 * viewer, with the most-liked content as the cold-start default for new
 * users until their taste signal accumulates. Video embeds live ONLY in
 * Your Taste until the feature is fully fledged out.
 *
 * Server component — a plain privacy-enhanced (youtube-nocookie) iframe,
 * no API key or client JS. next.config.ts CSP `frame-src` allowlists the
 * two YouTube player hosts; nothing else may be framed.
 */

interface FeaturedVideoProps {
  /** The 11-char YouTube video id (e.g. "yBBumoYwkGc"). */
  videoId: string;
  /** Shown as the iframe title (a11y) and the caption line. */
  title: string;
}

export default function FeaturedVideo({ videoId, title }: FeaturedVideoProps) {
  return (
    <div className="panel-xbox p-3 sm:p-4 space-y-2 relative overflow-hidden">
      <div className="aspect-video w-full rounded-lg overflow-hidden border border-border-subtle bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
      <p className="text-xs text-text-secondary truncate" title={title}>
        {title}
      </p>
      <div className="scan-bar" />
    </div>
  );
}
