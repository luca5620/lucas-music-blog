/**
 * TunedToYou — the algorithmic shelf on Your Taste.
 *
 * Renders the mixed picks from lib/taste.ts getTunedToYou(): reviews,
 * debates, and releases in one grid, each with a small type tag and —
 * only where one clean signal explains the pick — a reason chip
 * ("you rated Phantogram 9/10", "popular right now").
 *
 * Server component, purely presentational; all scoring happens in
 * lib/taste.ts.
 */

import Link from "next/link";
import type { TunedItem } from "@/lib/taste";
import { getRatingHex, formatRating } from "@/lib/rating";

/** Only https:// or local /path images (stored-XSS defense). */
function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

function TypeTag({ label }: { label: string }) {
  return (
    <span className="pixel-text text-[9px] uppercase px-1 py-px rounded border border-border-medium text-text-muted">
      {label}
    </span>
  );
}

function ReasonChip({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return (
    <span className="block text-[10px] text-accent-primary/80 truncate" title={reason}>
      ◈ {reason}
    </span>
  );
}

function Card({ item }: { item: TunedItem }) {
  const cover = safeImage(item.cover_image);
  const href =
    item.type === "review"
      ? `/reviews/${item.slug}`
      : item.type === "debate"
        ? `/debates/${item.slug}`
        : `/releases/${item.slug}`;

  return (
    <Link href={href} className="group space-y-1.5" title={item.title}>
      <span className="poster">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={`${item.title} cover`} />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-4xl">
            {item.type === "debate" ? "🎙️" : "💿"}
          </span>
        )}
        {item.type === "review" && (
          <span
            className="poster-rating"
            style={{ color: getRatingHex(item.rating) }}
          >
            {formatRating(item.rating)}
          </span>
        )}
        {item.type === "release" && item.is_unreleased && (
          <span className="poster-unreleased">UNRELEASED</span>
        )}
      </span>
      <span className="block space-y-0.5">
        <span className="flex items-center gap-1">
          <TypeTag
            label={
              item.type === "review"
                ? "Review"
                : item.type === "debate"
                  ? "Debate"
                  : "Release"
            }
          />
          <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)] group-hover:text-accent-primary transition-colors">
            {item.title}
          </span>
        </span>
        <span className="block text-xs text-text-secondary truncate">
          {item.type === "review" && `@${item.username} · ${item.artist}`}
          {item.type === "debate" &&
            `${item.side_a_label} vs ${item.side_b_label} · ${item.activity} in the arena`}
          {item.type === "release" && item.artist}
        </span>
        <ReasonChip reason={item.reason} />
      </span>
    </Link>
  );
}

export default function TunedToYou({ items }: { items: TunedItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="poster-grid">
      {items.map((item) => (
        <Card key={`${item.type}:${item.slug}`} item={item} />
      ))}
    </div>
  );
}
