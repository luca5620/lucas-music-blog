import type { Gif } from "@/lib/gif";

/**
 * GifView — a GIF attached to a review or comment (2026-10-11).
 *
 * Server-safe (no hooks), so the review page renders it directly.
 * The stored width/height become the box's aspect ratio, so the
 * space is reserved before the GIF arrives — no jump when it loads,
 * and no growth for the page-tall liquid canvas to react to.
 *
 * The URL is used exactly as KLIPY gave it (their terms), and the
 * small "via KLIPY" mark is their attribution rule.
 */
export default function GifView({
  gif,
  size = "md",
  alt = "GIF",
}: {
  gif: Gif;
  /** md = review body (up to 320px wide), sm = comments (220px). */
  size?: "sm" | "md";
  alt?: string;
}) {
  const maxW = size === "sm" ? 220 : 320;
  return (
    <figure className="inline-block max-w-full" style={{ width: maxW }}>
      <div
        className="rounded-lg overflow-hidden border border-border-subtle bg-black/30"
        style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gif.url}
          alt={alt}
          width={gif.width}
          height={gif.height}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover block"
        />
      </div>
      <figcaption className="text-[9px] text-text-muted mt-0.5 tracking-wide">
        via KLIPY
      </figcaption>
    </figure>
  );
}
