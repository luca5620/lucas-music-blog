"use client";

/**
 * Leaderboard — the Friends-tab charts (Luca 2026-08-26).
 *
 * One payload from leaderboard_stats() (migration 023), three tabs
 * that just re-sort it client-side: most reviews written, most likes
 * received on reviews, most lists made. Top ten per tab; the top
 * three ranks get medal colors. Rows link to profiles — the whole
 * point is finding the heavy hitters worth following (community
 * building).
 */

import { useState } from "react";
import Link from "next/link";
import type { LeaderboardRow } from "@/lib/db/leaderboard";

/** Only https:// or local /path images (stored-XSS defense). */
function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

const TABS = [
  { key: "reviews", label: "Reviews", noun: "reviews" },
  { key: "likes", label: "Likes", noun: "likes" },
  { key: "lists", label: "Lists", noun: "lists" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function countFor(row: LeaderboardRow, tab: TabKey): number {
  if (tab === "reviews") return row.review_count;
  if (tab === "likes") return row.likes_received;
  return row.list_count;
}

/** Gold / silver / bronze for the podium; muted for everyone else. */
const RANK_COLORS = ["#ffd700", "#c0c0c0", "#cd7f32"];

export default function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const [tab, setTab] = useState<TabKey>("reviews");

  const ranked = rows
    .filter((r) => countFor(r, tab) > 0)
    .sort((a, b) => countFor(b, tab) - countFor(a, tab))
    .slice(0, 10);

  const noun = TABS.find((t) => t.key === tab)!.noun;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="label-xbox">Leaderboard</h2>
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`tab-y2k ${tab === t.key ? "tab-active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="panel-xbox p-6 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-lg text-[#5a5a60]">
            No {noun} on the board yet.
          </p>
        </div>
      ) : (
        <div className="panel-xbox divide-y divide-border-subtle">
          {ranked.map((row, i) => {
            const name = row.display_name || row.username;
            const avatar = safeImage(row.avatar_url);
            const rankColor = RANK_COLORS[i] ?? "#5a5a60";
            return (
              <Link
                key={row.user_id}
                href={`/profile/${row.username}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg-elevated transition-colors"
              >
                {/* Rank — pixel type, medal colors on the podium */}
                <span
                  className="w-7 shrink-0 text-center font-[family-name:var(--font-vt323)] text-lg font-bold"
                  style={{ color: rankColor }}
                >
                  {i + 1}
                </span>

                <span className="w-9 h-9 rounded-full overflow-hidden bg-bg-elevated border border-[rgba(255,255,255,0.15)] flex items-center justify-center shrink-0">
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-[#9a9a9e] font-bold">
                      {name[0]?.toUpperCase()}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#e8e6e3] truncate">
                    {name}
                  </span>
                  <span className="block font-[family-name:var(--font-vt323)] text-xs text-[#5a5a60] truncate">
                    @{row.username}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block font-[family-name:var(--font-heading)] font-bold text-accent-primary">
                    {countFor(row, tab)}
                  </span>
                  <span className="block pixel-text text-[9px] uppercase tracking-widest text-text-muted">
                    {noun}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
