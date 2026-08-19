import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { getVoteCountsFor } from "@/lib/db/debates";

/**
 * POST /api/debates/[debateId]/vote — pick (or switch) a side.
 * Body: { side: "a" | "b" }
 *
 * debate_votes has PRIMARY KEY (debate_id, user_id), so an upsert is
 * literally "one vote per user, latest choice wins". RLS restricts the
 * row to auth.uid() = user_id, and we take user_id from the session
 * anyway — the body can never vote on someone else's behalf.
 *
 * Returns the fresh counts so the UI can reconcile its optimistic bar.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const { debateId } = await params;

  if (!isUuid(debateId)) {
    return NextResponse.json({ error: "Invalid debate." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generous — switching sides mid-argument is part of the fun.
  const limited = rateLimit(`debate-vote:${user.id}`, 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { side } = (body ?? {}) as { side?: unknown };
  if (side !== "a" && side !== "b") {
    return NextResponse.json(
      { error: 'side must be "a" or "b".' },
      { status: 400 }
    );
  }

  // Closed debates are read-only history.
  const { data: debate } = await supabase
    .from("debates")
    .select("id, status")
    .eq("id", debateId)
    .single();

  if (!debate) {
    return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  }
  if ((debate as { status: string }).status === "closed") {
    return NextResponse.json(
      { error: "This debate is closed." },
      { status: 403 }
    );
  }

  const { error } = await supabase.from("debate_votes").upsert(
    {
      debate_id: debateId,
      user_id: user.id,
      side,
    } as never,
    { onConflict: "debate_id,user_id" }
  );

  if (error) {
    console.error("debate vote failed:", error.message);
    return NextResponse.json(
      { error: "Vote didn't land. Try again." },
      { status: 500 }
    );
  }

  const counts = await getVoteCountsFor([debateId]);
  return NextResponse.json({
    side,
    votes: counts.get(debateId) ?? { a: 0, b: 0 },
  });
}
