import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

/**
 * Supporters — data helpers (migration 061, 2026-10-25).
 *
 * public.supporters is the PUBLIC half: who supports and since when,
 * no amounts (amounts live in supporter_payments, which no app user
 * can read). Both helpers fail soft — before 061 runs the table
 * doesn't exist, and the profile/support pages must still render.
 */

export interface SupporterWallEntry {
  since: string;
  profile: Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "role">;
}

/** When this member first supported, or null if never. */
export async function getSupporterSince(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supporters")
    .select("since")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { since: string }).since;
}

/** The supporters wall on /support — oldest first, the day-ones lead. */
export async function getSupporterWall(limit = 200): Promise<SupporterWallEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supporters")
    .select("since, profile:profiles!supporters_user_id_fkey(id, username, display_name, avatar_url, role)")
    .order("since", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown as SupporterWallEntry[]).filter((row) => row.profile);
}
