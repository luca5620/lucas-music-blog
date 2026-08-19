import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { getReportById, setReportStatus } from "@/lib/db/moderation";
import type { Profile } from "@/lib/types/database";

/**
 * POST /api/admin/reports/[reportId]  { action }
 *
 *   action: "resolve"        → mark handled (content was fine or
 *                              dealt with elsewhere)
 *   action: "dismiss"        → mark bogus/spam report
 *   action: "delete_content" → delete the reported row (where that
 *                              makes sense), then mark resolved
 *
 * Staff-only. Deletion runs with the admin's session — the delete
 * policies from migration 007 are what actually authorize it.
 */

/** target_type → table it lives in. Types missing here (profile,
    debate) can't be bulk-deleted from the queue — resolve instead
    and handle them by hand. */
const DELETABLE: Record<string, string> = {
  review: "reviews",
  comment: "comments",
  debate_message: "debate_messages",
  room_message: "room_messages",
  list: "lists",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;

  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Role check — same gate as /api/admin/import.
  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as Pick<Profile, "role"> | null)?.role;
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = rateLimit(`admin-reports:${user.id}`, 60, 60_000);
  if (limited) return limited;

  // 3. Validate input
  if (!isUuid(reportId)) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { action } = (body ?? {}) as { action?: string };
  if (action !== "resolve" && action !== "dismiss" && action !== "delete_content") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const report = await getReportById(reportId);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  try {
    if (action === "delete_content") {
      const table = DELETABLE[report.target_type];
      if (table) {
        // RLS (007's admin delete policies) authorizes this delete.
        // If the row is already gone, delete is a no-op — fine.
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("id", report.target_id);
        if (error) {
          throw new Error(`delete from ${table} failed: ${error.message}`);
        }
      }
      // Whether or not the type was deletable, the report is handled.
      await setReportStatus(reportId, "resolved");
      return NextResponse.json({
        ok: true,
        deleted: !!table,
        status: "resolved",
      });
    }

    const status = action === "resolve" ? "resolved" : "dismissed";
    await setReportStatus(reportId, status);
    return NextResponse.json({ ok: true, deleted: false, status });
  } catch (err) {
    console.error("admin report action failed:", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
