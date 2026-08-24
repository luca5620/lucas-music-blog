import { createClient } from "@/lib/supabase/server";

/**
 * Song of the Day — data helpers.
 *
 * One pick per user per PACIFIC calendar day (America/Los_Angeles —
 * Luca 2026-08-23: the old UTC boundary reset streaks at 5pm his
 * time); consecutive days build a streak (computed by the
 * get_sotd_streak SQL function so it can never drift out of sync
 * with the actual rows).
 */

export interface SongOfDay {
  id: string;
  user_id: string;
  picked_on: string; // YYYY-MM-DD
  release_id: string | null;
  track_title: string;
  artist: string;
  cover_image: string | null;
  track_url: string | null;
  created_at: string;
}

/** The user's most recent pick (today's if set, else an older one). */
export async function getLatestSotd(userId: string): Promise<SongOfDay | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("song_of_day")
    .select("*")
    .eq("user_id", userId)
    .order("picked_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as SongOfDay;
}

/** Current streak in days (0 = broken/never; alive-but-unset-today still counts). */
export async function getSotdStreak(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sotd_streak", {
    user_uuid: userId,
  } as never);

  if (error || data == null) return 0;
  return typeof data === "number" ? data : Number(data) || 0;
}

/** YYYY-MM-DD in Pacific time, shifted by whole days (0 = today,
    -1 = yesterday). en-CA is the locale whose date format IS ISO. */
export function pacificDate(offsetDays = 0): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

/** True if `picked_on` is today's Pacific date (streak already extended). */
export function isTodayPacific(pickedOn: string): boolean {
  return pickedOn === pacificDate();
}
