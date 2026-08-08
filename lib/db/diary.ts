import { createClient } from "@/lib/supabase/server";
import type {
  DiaryEntry,
  DiaryStats,
  RatingBucket,
} from "@/lib/types/database";

/* ============================================
   Diary data access — listening log (migration 004)

   All functions run server-side (server components / API routes)
   through the cookie-aware Supabase client, so Row Level Security
   applies automatically: anyone can READ diary entries, but
   INSERT / UPDATE / DELETE only succeed on your own rows.
   ============================================ */

/**
 * Fetch a user's diary entries, newest listen first.
 * `limit` / `offset` allow simple pagination (e.g. "load more" later).
 */
export async function getDiaryEntries(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<DiaryEntry[]> {
  const supabase = await createClient();

  // Default page size: 50 entries. Offset defaults to the start.
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", userId)
    // Newest listen date first; created_at breaks ties so two logs on
    // the same day keep a stable order (most recently logged first).
    .order("listened_on", { ascending: false })
    .order("created_at", { ascending: false })
    // .range() is inclusive on both ends, hence the -1.
    .range(offset, offset + limit - 1);

  if (error || !data) return [];
  return data as DiaryEntry[];
}

/**
 * Fetch a single diary entry by its id (used by the API routes to
 * check ownership before updating/deleting).
 */
export async function getDiaryEntryById(
  entryId: string
): Promise<DiaryEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("id", entryId)
    .single();

  if (error || !data) return null;
  return data as DiaryEntry;
}

/**
 * Insert a new diary entry. The caller (API route) is responsible for
 * validation and for supplying user_id from the SESSION, never from
 * client input. RLS double-checks that user_id === auth.uid().
 */
export async function createDiaryEntry(
  entry: Omit<DiaryEntry, "id" | "created_at" | "updated_at">
): Promise<DiaryEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    // `as never` sidesteps the generated Insert type friction —
    // same pattern used across lib/db (see reviews.ts, rooms.ts).
    .insert(entry as never)
    .select()
    .single();

  if (error || !data) return null;
  return data as DiaryEntry;
}

/**
 * Update an existing entry. Only the mutable fields can be passed —
 * id / user_id / created_at are excluded at the type level so a bug
 * can't accidentally reassign an entry to another user.
 */
export async function updateDiaryEntry(
  entryId: string,
  updates: Partial<Omit<DiaryEntry, "id" | "user_id" | "created_at">>
): Promise<DiaryEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    // Bump updated_at ourselves too (the DB trigger also does this,
    // but being explicit keeps the returned row accurate).
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq("id", entryId)
    .select()
    .single();

  if (error || !data) return null;
  return data as DiaryEntry;
}

/**
 * Delete an entry by id. Returns true on success.
 * RLS guarantees only the owner's delete actually removes a row.
 */
export async function deleteDiaryEntry(entryId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("diary_entries")
    .delete()
    .eq("id", entryId);
  return !error;
}

/**
 * Summary stats for a profile via the get_diary_stats() SQL function:
 * total logs, logs this year, relistens, and average rating.
 *
 * Postgres "returns table" functions come back as an array of rows,
 * so we unwrap the single row (and fall back to zeros if anything
 * goes wrong so pages never crash on stats).
 */
export async function getDiaryStats(userId: string): Promise<DiaryStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_diary_stats", {
    profile_uuid: userId,
  } as never);

  // Safe empty default — a brand-new diary has no entries yet.
  const empty: DiaryStats = {
    total_entries: 0,
    entries_this_year: 0,
    relistens: 0,
    avg_rating: null,
  };

  if (error || !data) return empty;

  // supabase-js may surface the row directly or wrapped in an array.
  const row = (Array.isArray(data) ? data[0] : data) as DiaryStats | undefined;
  if (!row) return empty;

  return {
    total_entries: Number(row.total_entries ?? 0),
    entries_this_year: Number(row.entries_this_year ?? 0),
    relistens: Number(row.relistens ?? 0),
    // avg is null when the user has never rated anything.
    avg_rating: row.avg_rating === null ? null : Number(row.avg_rating),
  };
}

/**
 * Whole-number rating histogram (0–10 buckets) across a user's diary
 * entries + published reviews, via get_rating_distribution().
 * Powers the little histogram on profiles.
 */
export async function getRatingDistribution(
  userId: string
): Promise<RatingBucket[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_rating_distribution", {
    profile_uuid: userId,
  } as never);

  if (error || !data) return [];

  const rows = (Array.isArray(data) ? data : [data]) as RatingBucket[];
  // Coerce to plain numbers (bigint counts arrive as strings sometimes).
  return rows.map((r) => ({
    bucket: Number(r.bucket),
    count: Number(r.count),
  }));
}
