/**
 * Leaderboard — per-user activity counts for the Friends tab
 * (Luca 2026-08-26: "users with the most reviews, most likes, etc").
 *
 * All the counting happens in Postgres via the leaderboard_stats()
 * function (migration 023) — one RPC returns the top users by
 * combined activity, and the client component sorts the same payload
 * per tab (reviews / likes received / lists). Until the migration is
 * run in the SQL Editor the RPC errors; we swallow that into an
 * empty array and the page simply hides the section.
 */

import { createClient } from "@/lib/supabase/server";

export interface LeaderboardRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  review_count: number;
  likes_received: number;
  list_count: number;
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leaderboard_stats", {
    limit_n: limit,
  } as never);
  if (error || !data) return [];

  // bigint comes over the wire as number here (counts stay far below
  // 2^53), but coerce defensively in case a driver hands us strings.
  return (data as unknown as Record<string, unknown>[]).map((r) => ({
    user_id: String(r.user_id),
    username: String(r.username ?? ""),
    display_name: (r.display_name as string | null) ?? null,
    avatar_url: (r.avatar_url as string | null) ?? null,
    review_count: Number(r.review_count ?? 0),
    likes_received: Number(r.likes_received ?? 0),
    list_count: Number(r.list_count ?? 0),
  }));
}
