/**
 * /your-taste — the "For You" channel.
 *
 * ONE surface now (Luca 2026-08-27: the BECAUSE YOU FOLLOW and
 * ANTICIPATED poster grids are REMOVED — the page is the channel,
 * nothing else): TUNED TO YOU, the algorithmic pager (lib/taste.ts).
 * Reviews, debates, and releases mixed, 70% taste match / 30%
 * popularity, most-liked fallback for cold-start users, reason chips
 * only where one clean signal explains a pick.
 *
 * Server component; auth required (middleware also gates nothing
 * here, so we redirect ourselves via requireAuth).
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PageHero from "@/components/ui/PageHero";
import ChannelSurf from "@/components/taste/ChannelSurf";
import { buildTasteProfile, getTunedToYou } from "@/lib/taste";
import { resolveAppleEmbedsForReleases } from "@/lib/apple-music";

// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Your Taste",
  robots: { index: false, follow: false },
};

// Per-viewer page — always render fresh.
export const dynamic = "force-dynamic";

export default async function YourTastePage() {
  const user = await requireAuth();
  const t = await getTranslations("taste.page");
  const supabase = await createClient();

  /* ---- Taste profile + the people the viewer follows (the pager
     boosts followed authors and says so in its reason chips) ---- */
  const profile = await buildTasteProfile(user.id);
  const { data: peopleFollows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);
  const peopleIds = ((peopleFollows ?? []) as { following_id: string }[]).map(
    (r) => r.following_id
  );

  /* ---- The TUNED TO YOU picks ---- */
  const tunedRaw = await getTunedToYou(profile, user.id, {
    followedUserIds: peopleIds,
  });

  /* ---- Apple Music in the pager (Luca 2026-09-08: the Settings pick
     "did not carry over" here). Same rule as the release page: Apple's
     embed only for members who chose it, resolved lazily and cached
     on the release row; Spotify for everyone else, and for records
     Apple doesn't carry. ---- */
  const { data: pref } = await supabase
    .from("profiles")
    .select("preferred_player")
    .eq("id", user.id)
    .maybeSingle();
  const wantsApple =
    (pref as { preferred_player?: string } | null)?.preferred_player === "apple";
  let tunedItems = tunedRaw;
  if (wantsApple) {
    const releaseIds = tunedRaw.flatMap((it) =>
      it.type === "release" ? [it.id] : it.type === "review" && it.release_id ? [it.release_id] : []
    );
    const embeds = await resolveAppleEmbedsForReleases(releaseIds);
    tunedItems = tunedRaw.map((it) => {
      if (it.type === "release") {
        return { ...it, apple_embed_url: embeds.get(it.id) ?? null };
      }
      if (it.type === "review" && it.release_id) {
        return { ...it, apple_embed_url: embeds.get(it.release_id) ?? null };
      }
      return it;
    });
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header — boxed hero, same as HOME */}
      <PageHero
        title={t("title")}
        sub={t("sub")}
      />

      {/* ===== Tuned to you — the channel-surf pager, the whole
             show. Same panel width as the hero on EVERY size (Luca
             2026-08-28: no more phone full-bleed — the pager and the
             CD module line up like they do on the website). ===== */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="vhs-label text-sm">{t("tunedToYou")}</span>
          <span className="text-text-secondary text-xs hidden sm:inline">
            {t("swipeHint")}
          </span>
          <div className="flex-1 divider-glow" />
        </div>
        {tunedItems.length > 0 ? (
          <ChannelSurf items={tunedItems} />
        ) : (
          <div className="panel-xbox p-6 sm:p-8 text-center space-y-4">
            <p className="osd-text text-sm">{t("noSignal")}</p>
            <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
              {t("empty")}
            </p>
            <Link href="/releases" className="btn-y2k btn-y2k-outline inline-block">
              {t("browse")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
