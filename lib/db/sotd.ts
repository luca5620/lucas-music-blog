import { createClient } from "@/lib/supabase/server";

/**
 * Song of the Day — data helpers.
 *
 * One pick per user per UTC calendar day; consecutive days build a
 * streak (computed by the get_sotd_streak SQL function so it can
 * never drift out of sync with the actual rows).
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

/** True if `picked_on` is today's UTC date (streak already extended). */
export function isTodayUtc(pickedOn: string): boolean {
  return pickedOn === new Date().toISOString().slice(0, 10);
}
