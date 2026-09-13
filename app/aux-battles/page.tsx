import type { Metadata } from "next";
import Link from "next/link";
import { listAuxRooms, listAuxRoomsJoined, type AuxRoomWithMeta } from "@/lib/db/aux-battles";
import { getUser } from "@/lib/auth";
import { getViewerBlockedIdSet } from "@/lib/db/moderation";
import AuxCard from "@/components/aux-battles/AuxCard";
import JoinByCode from "@/components/aux-battles/JoinByCode";
import PageHero from "@/components/ui/PageHero";
import BackToHome from "@/components/ui/BackToHome";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Aux Battles",
  description:
    "Pass the aux. Two songs go head to head, the room listens, the room votes. Brackets, best-of-3s, live chat.",
};

// Rooms open, start and finish minute to minute — always fresh.
export const dynamic = "force-dynamic";

/** One titled grid of room cards; renders nothing for an empty list. */
function Section({ title, list }: { title: string; list: AuxRoomWithMeta[] }) {
  if (list.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="label-xbox">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((r) => (
          <AuxCard key={r.id} room={r} />
        ))}
      </div>
    </section>
  );
}

/**
 * /aux-battles — the arena index (replaced /debates, Luca 2026-09-13).
 * Live rooms first, then lobbies filling up, then the last results.
 * Private rooms never show here; the code box is their door.
 */
export default async function AuxBattlesPage() {
  const [rooms, user, blocked] = await Promise.all([
    listAuxRooms(),
    getUser(),
    getViewerBlockedIdSet(),
  ]);
  const joined = user ? await listAuxRoomsJoined(user.id) : [];
  const t = await getTranslations("aux.index");

  // Blocked hosts never reach the viewer's wall (App Store 1.2).
  const keep = (list: typeof rooms.live) => list.filter((r) => !blocked.has(r.host_id));
  const live = keep(rooms.live);
  const lobby = keep(rooms.lobby);
  const finished = keep(rooms.finished);
  const privateJoined = joined.filter((r) => r.is_private && r.status !== "finished");

  return (
    <div className="space-y-6 circuit-bg">
      {/* App-only way back to the home page (this page has no tab) */}
      <BackToHome />

      <PageHero title={t("title")} sub={t("sub")}>
        <div className="pt-1 flex flex-wrap items-center gap-3">
          <Link href="/aux-battles/new" className="btn-y2k btn-y2k-primary">
            {t("host")}
          </Link>
          <JoinByCode />
        </div>
      </PageHero>

      <Section title={t("yourPrivate")} list={privateJoined} />
      <Section title={t("liveNow")} list={live} />
      <Section title={t("fillingUp")} list={lobby} />
      <Section title={t("lastResults")} list={finished} />

      {live.length + lobby.length + finished.length === 0 && (
        <div className="panel-xbox p-10 text-center space-y-3">
          <p className="osd-text text-sm">{t("noSignal")}</p>
          <p className="text-sm text-text-muted">{t("empty")}</p>
        </div>
      )}
    </div>
  );
}
