import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid, isText } from "@/lib/validate";
import {
  createReport,
  REPORT_TARGET_TYPES,
  type ReportTargetType,
} from "@/lib/db/moderation";

/**
 * POST /api/reports  { target_type, target_id, reason }
 *
 * Files a content report into the moderation queue. Required by
 * App Store guideline 1.2 (UGC apps must have a report mechanism),
 * and just the right thing to have anyway.
 *
 * We deliberately do NOT verify the target row exists — that would
 * let people probe which ids exist across tables. A report against
 * a deleted/nonexistent id just gets dismissed in the queue.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 10 reports per hour is plenty for good-faith use and starves spam.
  const limited = rateLimit(`reports:${user.id}`, 10, 3_600_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { target_type, target_id, reason } = (body ?? {}) as {
    target_type?: string;
    target_id?: string;
    reason?: string;
  };

  if (!REPORT_TARGET_TYPES.includes(target_type as ReportTargetType)) {
    return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
  }
  if (!isUuid(target_id)) {
    return NextResponse.json({ error: "Invalid target id" }, { status: 400 });
  }
  if (!isText(reason, 500) || reason!.trim().length < 3) {
    return NextResponse.json(
      { error: "Reason must be 3–500 characters" },
      { status: 400 }
    );
  }

  try {
    await createReport(
      user.id,
      target_type as ReportTargetType,
      target_id!,
      reason!.trim()
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("report create failed:", err);
    return NextResponse.json({ error: "Could not file report" }, { status: 500 });
  }
}
