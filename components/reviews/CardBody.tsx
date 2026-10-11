import Link from "next/link";
import { gifFromRow } from "@/lib/gif";

/**
 * CardBody — the words + GIF box on a review CARD (2026-10-11).
 *
 * Used by the home Community Feed (DiscoveryFeedClient) and the
 * /reviews wall (ReviewsList), so both cards behave identically.
 *
 * THE RULE (Luca 2026-10-11): the GIF lives inside the SAME box the
 * words already get — it never makes a card taller than a card full
 * of text would be. The box is CARD_LINES lines of text tall:
 *  - no words      → the GIF gets the whole box
 *  - a few words   → the words, then the GIF in whatever's left
 *  - lots of words → words only; the GIF waits on the review page,
 *                    and a "read the full review" link says there's
 *                    more there
 *
 * "How many lines will these words take" is ESTIMATED from the text
 * (characters per line at the narrowest card width) rather than
 * measured, so cards render on the server with their final height —
 * no jump after load, nothing for the page-tall liquid canvas to
 * react to. The estimate leans long on purpose: guessing too many
 * lines only makes the GIF a bit smaller, never overflows the box.
 *
 * Server-safe (no hooks) — it renders inside client components too.
 */

/** The box height, in lines of text. Was a 6-line clamp; the 7th
 *  line came out of the card's bottom padding (Luca 2026-10-11:
 *  "a little bit of dead space under the date"). */
export const CARD_LINES = 7;

/** One line of the card's text-xs / leading-relaxed text, in rem
 *  (0.75rem × 1.625). The GIF's height is counted in these. */
const LINE_REM = 1.22;

/** Characters per line at the narrowest card (5 per row on a wide
 *  desktop, ~220px of text). Wider cards fit more, which only means
 *  real text ends sooner than estimated. */
const CHARS_PER_LINE = 36;

/** A GIF smaller than this many lines is a postage stamp — skip it
 *  and let the review page show it properly. */
const MIN_GIF_LINES = 4;

/** Above this the clamp is certainly cutting words off. */
const LONG_READ_CHARS = 320;

function estimateLines(text: string): number {
  return text
    .split("\n")
    .reduce((n, para) => n + Math.max(1, Math.ceil(para.length / CHARS_PER_LINE)), 0);
}

export default function CardBody({
  body,
  review,
  href,
  readFullLabel,
}: {
  /** summary ?? snippet — the words the card shows. */
  body: string | null;
  /** The review row (only its gif_* columns are read). */
  review: {
    gif_url?: string | null;
    gif_width?: number | null;
    gif_height?: number | null;
  };
  href: string;
  readFullLabel: string;
}) {
  const gif = gifFromRow(review);
  const text = body?.trim() ? body : null;

  const isLongRead = !!text && text.length > LONG_READ_CHARS;
  const textLines = text ? Math.min(estimateLines(text), CARD_LINES) : 0;
  const gifLines = CARD_LINES - textLines;
  const showGif = !!gif && !isLongRead && gifLines >= MIN_GIF_LINES;
  // A GIF that didn't fit still counts as "more on the review page".
  const showReadFull = isLongRead || (!!gif && !showGif);

  if (!text && !gif) return null;

  return (
    <>
      <div className="pt-2 border-t border-white/5 space-y-2">
        {text && (
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line line-clamp-7">
            {text}
          </p>
        )}
        {showGif && gif && (
          <Link href={href} className="block w-fit max-w-full relative">
            {/* Fixed height (the space left in the box), width from
                the GIF's own shape — reserved before it loads.
                object-contain keeps a very wide GIF undistorted when
                max-width squeezes it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gif.url}
              alt="GIF"
              width={gif.width}
              height={gif.height}
              loading="lazy"
              decoding="async"
              className="block max-w-full w-auto rounded-md border border-white/10 bg-black/30 object-contain"
              style={{
                height: `${(gifLines * LINE_REM - (text ? 0.5 : 0)).toFixed(2)}rem`,
                aspectRatio: `${gif.width} / ${gif.height}`,
              }}
            />
            {/* KLIPY's attribution, as a corner tag so it costs no
                extra line in the box. */}
            <span className="absolute bottom-1 right-1 px-1 rounded-sm bg-black/60 text-[8px] leading-tight tracking-wide text-white/70">
              KLIPY
            </span>
          </Link>
        )}
      </div>
      {showReadFull && (
        <Link
          href={href}
          className="block pixel-text text-[0.65rem] uppercase tracking-widest text-accent-primary hover:text-accent-glow transition-colors"
        >
          {readFullLabel}
        </Link>
      )}
    </>
  );
}
