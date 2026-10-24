import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { sessionUsedEmailCode } from "@/lib/auth/amr";
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
 *   action: "remove_avatar" / "remove_banner"
 *                            → PROFILE reports only: delete that
 *                              member's uploaded picture/banner files
 *                              and blank the column. The report stays
 *                              OPEN — a profile can need both images
 *                              pulled, so staff resolve it afterwards.
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
  aux_message: "aux_messages",
  // A room's NAME and its round TOPICS are host-written text on a
  // public page, so a reported room has to be removable from here
  // too — not just by the host who wrote it (migration 046 adds the
  // staff delete policy this leans on). Matches, games, votes,
  // reactions and chat all cascade off it.
  aux_room: "aux_rooms",
  room_message: "room_messages",
  list: "lists",
  post: "posts",
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

  // 2b. Email-code gate — staff sessions must have gone through the
  // emailed code, not just a password (see lib/auth/amr.ts).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!sessionUsedEmailCode(session?.access_token)) {
    return NextResponse.json(
      { error: "Sign in again with your email code to use admin tools." },
      { status: 403 }
    );
  }

  const limited = await rateLimit(`admin-reports:${user.id}`, 60, 60_000);
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
  if (
    action !== "resolve" &&
    action !== "dismiss" &&
    action !== "delete_content" &&
    action !== "remove_avatar" &&
    action !== "remove_banner"
  ) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const report = await getReportById(reportId);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  try {
    if (action === "remove_avatar" || action === "remove_banner") {
      if (report.target_type !== "profile") {
        return NextResponse.json(
          { error: "Only profile reports have images to remove" },
          { status: 400 }
        );
      }
      const which = action === "remove_avatar" ? "avatar" : "banner";
      await removeProfileImage(supabase, report.target_id, which);
      return NextResponse.json({ ok: true, removed: which, status: "open" });
    }

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
    // MigrationMissing carries a message written for staff ("run 059");
    // anything else stays generic.
    const message = err instanceof MigrationMissing ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Thrown when the database doesn't have migration 059 yet, so the
    queue can say exactly that instead of a vague failure. */
class MigrationMissing extends Error {}

/**
 * Take one member's avatar or banner down — the FILES first (they are
 * the actual harmful thing, and a public URL keeps serving a file
 * until it's deleted), then the column that points at them.
 *
 * Every upload has a timestamped name (settings/profile/page.tsx) and
 * old ones are never cleaned up, so the member's whole folder in that
 * bucket is emptied, not just the file the profile shows today — an
 * earlier copy of the same image would otherwise still be reachable.
 *
 * Both steps run with the staff member's own session; migration 059
 * is what allows them (a storage delete policy + the
 * staff_clear_profile_image function).
 */
async function removeProfileImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  which: "avatar" | "banner"
): Promise<void> {
  const bucket = which === "avatar" ? "avatars" : "banners";

  // 1. Files. Listing works for anyone (the buckets are public-read).
  const { data: files, error: listError } = await supabase.storage
    .from(bucket)
    .list(profileId, { limit: 1000 });
  if (listError) throw new Error(`list ${bucket} failed: ${listError.message}`);

  const paths = (files ?? []).map((f) => `${profileId}/${f.name}`);
  if (paths.length > 0) {
    const { data: removed, error: removeError } = await supabase.storage
      .from(bucket)
      .remove(paths);
    if (removeError) {
      throw new Error(`remove from ${bucket} failed: ${removeError.message}`);
    }
    // Storage doesn't error when a policy forbids a delete — it just
    // deletes nothing. Nothing removed = the staff policy isn't there.
    if (!removed || removed.length === 0) {
      throw new MigrationMissing(
        "Couldn't delete the files — run migration 059 in the Supabase SQL editor first."
      );
    }
  }

  // 2. The column, through the narrow staff-only function.
  const { error: rpcError } = await supabase.rpc(
    "staff_clear_profile_image",
    { _target: profileId, _which: which } as never
  );
  if (rpcError) {
    // PGRST202 = function not found = migration not run.
    if (rpcError.code === "PGRST202") {
      throw new MigrationMissing(
        "Files deleted, but the profile still points at them — run migration 059 in the Supabase SQL editor, then press this again."
      );
    }
    throw new Error(`staff_clear_profile_image failed: ${rpcError.message}`);
  }
}
