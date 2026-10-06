/**
 * TasteTeaser — /your-taste for someone who isn't signed in
 * (2026-10-05).
 *
 * It used to redirect to /login, which greets you with "Welcome back"
 * — to a first-time visitor who just tapped a tab to see what it was.
 * Now the tab explains itself: what the channel is, how it tunes
 * itself, a preview made only of PUBLIC data (the newest community
 * reviews that carry a one-liner — the kind of card the channel
 * plays), and the two doors.
 *
 * Server component. The preview comes from getDiscoveryFeed with no
 * viewer, which is the cached, cookie-less public feed — identical for
 * every visitor, so it costs nothing per request.
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import { getDiscoveryFeed } from "@/lib/db/reviews";
import { smallCover } from "@/lib/images";
import { getRatingHex, formatRating } from "@/lib/rating";
import type { FeedReview } from "@/components/reviews/DiscoveryFeedClient";

/** How many preview cards to show — a glimpse, not the channel. */
const PREVIEW = 4;

export default async function TasteTeaser() {
  // LANGUAGES: messages → "taste.page" (shared title) + "taste.guest".
  const t = await getTranslations("taste.page");
  const tg = await getTranslations("taste.guest");

  const feed = (await getDiscoveryFeed(24).catch(() => [])) as unknown as FeedReview[];
  // Cards with words read best as a preview of a "channel"; fall back
  // to any rated cover if nobody has written a one-liner lately.
  const withWords = feed.filter((r) => r.cover_image && r.snippet);
  const pool = withWords.length >= PREVIEW ? withWords : feed.filter((r) => r.cover_image);
  // Different people first (same rule as the home page's community
  // wall): one card per author, then fill if there aren't enough
  // authors — a channel preview that is one person reads as a dead site.
  const authors = new Set<string>();
  const firstPerAuthor = pool.filter((r) => {
    if (authors.has(r.user_id)) return false;
    authors.add(r.user_id);
    return true;
  });
  const preview = [...firstPerAuthor, ...pool.filter((r) => !firstPerAuthor.includes(r))].slice(
    0,
    PREVIEW
  );

  const steps = [tg("how1"), tg("how2"), tg("how3")];

  return (
    <div className="space-y-8 pb-12">
      <PageHero title={t("title")} sub={tg("pitch")}>
        <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start pt-1">
          <Link href="/signup" className="btn-y2k btn-y2k-primary justify-center">
            {tg("cta")}
          </Link>
          <Link href="/login?next=/your-taste" className="btn-y2k btn-y2k-outline justify-center">
            {tg("signIn")}
          </Link>
        </div>
      </PageHero>

      {/* How it tunes itself — three numbered steps, VHS-label style */}
      <section className="panel-xbox p-5 sm:p-6 space-y-3">
        <span className="vhs-label text-sm">{tg("howLabel")}</span>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="osd-text text-xs shrink-0 pt-0.5">CH {String(i + 1).padStart(2, "0")}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* The preview — real, public community reviews */}
      {preview.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="vhs-label text-sm">{tg("previewLabel")}</span>
            <div className="flex-1 divider-glow" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {preview.map((r) => {
              const color = getRatingHex(r.rating);
              return (
                <Link
                  key={r.id}
                  href={`/reviews/${r.slug}`}
                  className="card-y2k p-3 flex items-start gap-3 hover-glow"
                >
                  <span className="poster w-16 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={smallCover(r.cover_image!)} alt="" loading="lazy" decoding="async" />
                    <span className="poster-rating" style={{ color, borderColor: `${color}80` }}>
                      {formatRating(r.rating)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)]">
                      {r.title}
                    </span>
                    <span className="block text-xs text-text-secondary truncate">{r.artist}</span>
                    {r.snippet && (
                      // No `block` here: line-clamp needs its own display (-webkit-box).
                      <span className="text-xs text-text-primary/90 line-clamp-2 leading-relaxed">
                        “{r.snippet}”
                      </span>
                    )}
                    {r.profiles?.username && (
                      <span className="block osd-text text-[10px] truncate">@{r.profiles.username}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* The locked part — say plainly why it needs an account */}
      <section className="panel-xbox p-6 text-center space-y-3 relative overflow-hidden">
        <p className="osd-text text-sm">{tg("lockedLabel")}</p>
        <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">{tg("lockedBody")}</p>
        <Link href="/signup" className="btn-y2k btn-y2k-primary inline-flex">
          {tg("cta")}
        </Link>
        <div className="scan-bar" />
      </section>
    </div>
  );
}
