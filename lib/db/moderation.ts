import { createClient } from "@/lib/supabase/server";

/**
 * Moderation data helpers — reports + blocks (migration 007).
 *
 * All of these run with the CALLER's session, so RLS does the
 * heavy lifting: regular users can only file reports and manage
 * their own block list; only owner/admin sessions can read the
 * full queue or change a report's status.
 */

export type ReportTargetType =
  | "review"
  | "comment"
  | "list"
  | "debate"
  | "debate_message"
  | "room_message"
  | "profile"
  | "post";

export const REPORT_TARGET_TYPES: ReportTargetType[] = [
  "review",
  "comment",
  "list",
  "debate",
  "debate_message",
  "room_message",
  "profile",
  "post",
];

export interface ContentReport {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
}

export interface ReportWithReporter extends ContentReport {
  reporter: {
    username: string;
    display_name: string | null;
  } | null;
}

/* ---------------------------------------------------------------
   Reports
   --------------------------------------------------------------- */

export async function createReport(
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string,
  reason: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("content_reports").insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason,
  } as never);

  if (error) {
    throw new Error(`createReport failed: ${error.message}`);
  }
}

/** Open reports, newest first, with the reporter's identity joined in. */
export async function getOpenReports(limit = 100): Promise<ReportWithReporter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_reports")
    .select("*, profiles!content_reports_reporter_id_fkey(username, display_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  type Row = ContentReport & {
    profiles:
      | { username: string; display_name: string | null }
      | { username: string; display_name: string | null }[]
      | null;
  };

  return (data as unknown as Row[]).map((row) => {
    const joined = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { ...row, reporter: joined ?? null };
  });
}

/** How many reports have already been handled (for the queue footer). */
export async function getHandledReportCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .neq("status", "open");
  return count ?? 0;
}

export async function getReportById(id: string): Promise<ContentReport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_reports")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as ContentReport;
}

export async function setReportStatus(
  id: string,
  status: "resolved" | "dismissed"
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_reports")
    .update({ status } as never)
    .eq("id", id);
  if (error) {
    throw new Error(`setReportStatus failed: ${error.message}`);
  }
}

/* ---------------------------------------------------------------
   Blocks
   --------------------------------------------------------------- */

/**
 * The signed-in viewer's block list as a Set, for server components
 * that render feeds. Signed-out (or any error) → empty set, so feeds
 * render unfiltered for anonymous visitors. Used with router.refresh()
 * after blocking, this is what makes blocked content vanish from
 * feeds instantly (App Store 1.2).
 */
export async function getViewerBlockedIdSet(): Promise<Set<string>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Set();
    return new Set(await getBlockedIds(user.id));
  } catch {
    return new Set();
  }
}

/** Every user id this user has blocked. */
export async function getBlockedIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);
  if (error || !data) return [];
  return (data as { blocked_id: string }[]).map((r) => r.blocked_id);
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("user_blocks").upsert(
    { blocker_id: blockerId, blocked_id: blockedId } as never,
    { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true }
  );
  if (error) {
    throw new Error(`blockUser failed: ${error.message}`);
  }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();
  return !!data;
}
