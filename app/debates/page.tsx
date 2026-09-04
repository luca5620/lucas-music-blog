import type { Metadata } from "next";
import Link from "next/link";
import { listDebates } from "@/lib/db/debates";
import { getUser } from "@/lib/auth";
import { getViewerBlockedIdSet } from "@/lib/db/moderation";
import DebateCard from "@/components/debates/DebateCard";
import PageHero from "@/components/ui/PageHero";
import BackToHome from "@/components/ui/BackToHome";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Debates",
  description:
    "Two sides, one vote, live arguments. Music's eternal questions, settled on air.",
};

// Vote counts and message counts move constantly — always render fresh.
export const dynamic = "force-dynamic";

/**
 * /debates — the arena index.
 * Every debate is a two-sided room: vote a side, argue it live.
 */
export default async function DebatesPage() {
  const [rawDebates, user, blocked] = await Promise.all([
    listDebates(24),
    getUser(),
    getViewerBlockedIdSet(),
  ]);
  // Blocked authors never reach the viewer's wall (App Store 1.2).
  const allDebates = rawDebates.filter((d) => !blocked.has(d.created_by));

  // RLS only ever hands back OTHER people's published debates, so the
  // unpublished rows here are necessarily the viewer's own drafts
  // (migration 024) — pull them out of the grid into a resume strip.
  const drafts = allDebates.filter(
    (d) => d.is_published === false && d.created_by === user?.id
  );
  const debates = allDebates.filter((d) => d.is_published !== false);
  const t = await getTranslations("debates.index");

  return (
    <div className="space-y-6 circuit-bg">
      {/* App-only way back to the home page (this page has no tab) */}
      <BackToHome />

      {/* ══════════ Header — boxed hero, same as HOME ══════════ */}
      <PageHero
        title={t("title")}
        sub={t("sub")}
      >
        <div className="pt-1">
          <Link href="/debates/new" className="btn-y2k btn-y2k-primary">
            {t("stake")}
          </Link>
        </div>
      </PageHero>

      {/* ══════════ Your drafts — hidden until you have one ══════════ */}
      {drafts.length > 0 && (
        <section className="space-y-3">
          <h2 className="label-xbox">{t("yourDrafts")}</h2>
          <div className="panel-xbox divide-y divide-border-subtle">
            {drafts.map((d) => (
              <Link
                key={d.id}
                href={`/debates/${d.slug}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg-elevated transition-colors"
              >
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-[family-name:var(--font-vt323)] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  {t("draft")}
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold text-[#e8e6e3] truncate">
                  {d.title}
                </span>
                <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
                  {t("openPublish")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ══════════ Debate grid ══════════ */}
      {debates.length === 0 ? (
        <div className="panel-xbox p-10 text-center space-y-3">
          <p className="osd-text text-sm">{t("noSignal")}</p>
          <p className="text-sm text-text-muted">
            {t("empty")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {debates.map((d) => (
            <DebateCard key={d.id} debate={d} />
          ))}
        </div>
      )}
    </div>
  );
}
