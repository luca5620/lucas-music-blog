import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPostById } from "@/lib/db/posts";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";

/**
 * POST /api/posts/[postId]/debate-vote  { side: "a" | "b" | null }
 *
 * One vote per person per debate post, switchable — post_debate_votes
 * has PRIMARY KEY (post_id, user_id), so this is an upsert and the
 * latest choice wins. `side: null` takes the vote back.
 *
 * Unlike Aux Wars, the AUTHOR may vote: on a post they are the person
 * asking the question, not one of the two sides.
 *
 * RLS is the real wall (migration 048) — it checks the post exists,
 * is actually a debate, and is visible to this reader. The tallies on
 * the post row are maintained by a trigger, so nothing here counts.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  if (!isUuid(postId)) {
    return NextResponse.json({ error: "Invalid post." }, { status: 400 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generous, like the Aux Wars vote: switching your mind is free and
  // an upsert can only ever rewrite this person's own single row.
  const limited = await rateLimit(`post-debate-vote:${user.id}`, 40, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const side = (body as { side?: unknown } | null)?.side;
  if (side !== "a" && side !== "b" && side !== null) {
    return NextResponse.json(
      { error: 'side must be "a", "b" or null.' },
      { status: 400 }
    );
  }

  const post = await getPostById(postId);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  if (!post.side_a_label) {
    return NextResponse.json(
      { error: "That post isn't a debate." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  if (side === null) {
    const { error } = await supabase
      .from("post_debate_votes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) {
      console.error("debate vote clear failed:", error.message);
      return NextResponse.json(
        { error: "Couldn't take your vote back. Try again." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, side: null });
  }

  const { error } = await supabase.from("post_debate_votes").upsert(
    { post_id: postId, user_id: user.id, side } as never,
    { onConflict: "post_id,user_id" }
  );

  if (error) {
    // An RLS refusal reads as a policy error — turn it into something
    // a person can act on rather than a 500.
    if (/policy|permission/i.test(error.message)) {
      return NextResponse.json(
        { error: "You can't vote on this one." },
        { status: 403 }
      );
    }
    // The table only exists once migration 048 has been run.
    if (/post_debate_votes/i.test(error.message)) {
      return NextResponse.json(
        { error: "Voting isn't switched on yet. Try again later." },
        { status: 503 }
      );
    }
    console.error("debate vote failed:", error.message);
    return NextResponse.json(
      { error: "Vote didn't land. Try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, side });
}
