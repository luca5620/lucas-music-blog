import type { Metadata } from "next";
import Link from "next/link";
import {
  getAuxLeaderboard,
  listAuxRooms,
  listAuxRoomsJoined,
  listRecentAuxResults,
  type AuxRoomWithMeta,
} from "@/lib/db/aux-wars";
import { getUser } from "@/lib/auth";
import { getViewerBlockedIdSet } from "@/lib/db/moderation";
import { lastFridayEasternUtcMs } from "@/lib/upcoming";
import AuxCard from "@/components/aux-wars/AuxCard";
import Leaderboard from "@/components/aux-wars/Leaderboard";
import JoinByCode from "@/components/aux-wars/JoinByCode";
import HowAuxWorks from "@/components/aux-wars/HowAuxWorks";
import RecentResult from "@/components/aux-wars/RecentResult";
import PageHero from "@/components/ui/PageHero";
import BackToHome from "@/components/ui/BackToHome";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Aux Wars",
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
 * /aux-wars — the arena index (replaced /debates, Luca 2026-09-13).
 * Live rooms first, then lobbies filling up, then the last results.
 * Private rooms never show here; the code box is their door.
 *
 * WHEN NOTHING IS ON AIR (code review 2026-10-05). The page used to
 * say "NO SIGNAL — no battles on air yet" over a one-person
 * leaderboard, which read to a visitor as "this feature is dead".
 * Now a quiet arena shows what a war IS instead:
 *   · the five-step "how a war goes" strip with the Host button,
 *     topped with an OFF AIR line when no lobby is filling up either
 *     (a lobby is the better invite), and
 *   · RECENT WARS from the tape vault — the last finished public wars
 *     with their topic, both songs and the champion, however old.
 * Rooms that have been quiet for two hours are hidden from the shelves
 * and finished (migration 053), so "live" here means really live.
 */
export default async function AuxWarsPage() {
  const [rooms, user, blocked, allTime, weekly, recent] = await Promise.all([
    listAuxRooms(),
    getUser(),
    getViewerBlockedIdSet(),
    getAuxLeaderboard("all"),
    // "This week" = since Friday 00:00 ET — the same week /social uses,
    // so the two pages never disagree about whose week it is.
    getAuxLeaderboard("week", 10, lastFridayEasternUtcMs()),
    listRecentAuxResults(4),
  ]);
  const joined = user ? await listAuxRoomsJoined(user.id) : [];
  const t = await getTranslations("aux.index");

  // Blocked hosts never reach the viewer's wall (App Store 1.2).
  const keep = (list: typeof rooms.live) => list.filter((r) => !blocked.has(r.host_id));
  const live = keep(rooms.live);
  const lobby = keep(rooms.lobby);
  const finished = keep(rooms.finished);
  const vault = recent.filter((r) => !blocked.has(r.room.host_id));
  // Only HIDDEN rooms need their own shelf — a plain private room now
  // shows up in the lists above like any other (migration 045: the
  // crowd can watch and vote, they just can't take a spot).
  const privateJoined = joined.filter((r) => r.is_hidden && r.status !== "finished");
  const quiet = live.length === 0;

  return (
    <div className="space-y-6 circuit-bg">
      {/* App-only way back to the home page (this page has no tab) */}
      <BackToHome />

      <PageHero title={t("title")} sub={t("sub")}>
        <div className="pt-1 flex flex-wrap items-center gap-3">
          <Link href="/aux-wars/new" className="btn-y2k btn-y2k-primary">
            {t("host")}
          </Link>
          <JoinByCode />
        </div>
      </PageHero>

      <Section title={t("yourPrivate")} list={privateJoined} />
      <Section title={t("liveNow")} list={live} />
      <Section title={t("fillingUp")} list={lobby} />

      {/* Something's on: the usual 24-hour results shelf. */}
      {!quiet && <Section title={t("lastResults")} list={finished} />}

      {quiet && (
        <>
          {/* How a war goes, with the Host button. Topped with the OFF
              AIR line only when there's no lobby to join either —
              otherwise "Filling up" above is the better invite. */}
          <HowAuxWorks offAir={lobby.length === 0} />

          {/* The tape vault: real past wars, so a quiet day still shows
              what one looks like. The 24h "Last results" rooms are the
              newest of these, so that shelf isn't repeated above. */}
          {vault.length > 0 && (
            <section className="space-y-3">
              <h2 className="label-xbox">{t("recentWars")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vault.map((r) => (
                  <RecentResult key={r.room.id} result={r} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Top ten — all time or this week. Blocked hosts are filtered
          out of the room lists above; the board is a site-wide stat,
          so it stands as it is. */}
      <Leaderboard
        allTime={allTime.filter((r) => !blocked.has(r.profile.id))}
        weekly={weekly.filter((r) => !blocked.has(r.profile.id))}
      />
    </div>
  );
}
