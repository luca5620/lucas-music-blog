import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { getDiaryEntries, getDiaryStats } from "@/lib/db/diary";
import LogListenModal from "@/components/diary/LogListenModal";
import DiaryTimeline from "@/components/diary/DiaryTimeline";

export const metadata: Metadata = {
  title: "My Diary",
};

/**
 * /diary — the logged-in user's listening diary.
 *
 * Server component: requires login (redirects to /login otherwise,
 * same as /reviews/mine), then renders:
 *   1. a stats row from get_diary_stats()
 *   2. the "Log a Listen" modal trigger
 *   3. the month-grouped timeline of entries (with owner controls)
 */
export default async function DiaryPage() {
  // Redirects to /login when there's no session.
  const user = await requireAuth();

  // Stats and entries don't depend on each other — fetch in parallel.
  const [stats, entries] = await Promise.all([
    getDiaryStats(user.id),
    getDiaryEntries(user.id, { limit: 200 }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ===== Header + Log button ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold text-[#e8e6e3]">
            My Diary
          </h1>
          <p className="font-[family-name:var(--font-vt323)] text-lg text-[#9a9a9e]">
            every listen, logged
          </p>
        </div>

        {/* Client component: renders its own trigger button + modal */}
        <LogListenModal />
      </div>

      {/* ===== Stats row (from get_diary_stats) ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total Logs" value={String(stats.total_entries)} />
        <StatTile label="This Year" value={String(stats.entries_this_year)} />
        <StatTile label="Relistens" value={`↻ ${stats.relistens}`} />
        <StatTile
          label="Avg Rating"
          // avg_rating is null until the user rates something
          value={stats.avg_rating !== null ? stats.avg_rating.toFixed(1) : "—"}
        />
      </div>

      {/* ===== The timeline itself (owner view: edit/delete enabled) ===== */}
      <DiaryTimeline entries={entries} isOwner />
    </div>
  );
}

/** One little stat box in the row — Y2K panel with a big VT323 number. */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-xbox p-4 text-center">
      <p className="font-[family-name:var(--font-vt323)] text-3xl text-[#e8e6e3] leading-none">
        {value}
      </p>
      <p className="label-xbox mt-2">{label}</p>
    </div>
  );
}
