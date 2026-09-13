import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isSafeSlug } from "@/lib/validate";
import { readJson } from "@/lib/aux-battles/guard";

/**
 * POST /api/aux-battles/join — enter a private room's code.
 * Body: { slug, code }
 *
 * aux_join_with_code (SECURITY DEFINER) checks the code and writes the
 * caller a viewer row, which is what makes the room visible to them
 * from then on. Wrong codes are rate-limited hard: six letters is a
 * small space, so guessing gets 10 tries per 10 minutes.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`aux-join:${user.id}`, 10, 600_000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { slug, code } = body;
  if (!isSafeSlug(slug)) {
    return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  }
  if (typeof code !== "string" || !/^[A-Za-z0-9]{6}$/.test(code.trim())) {
    return NextResponse.json({ error: "The code is six letters or digits." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("aux_join_with_code", {
    p_slug: slug,
    p_code: code.trim().toUpperCase(),
  } as never);

  if (error || !data) {
    const bad = /BAD_CODE/.test(error?.message ?? "");
    return NextResponse.json(
      { error: bad ? "That code doesn't open this room." : "Couldn't join. Try again." },
      { status: bad ? 403 : 500 }
    );
  }
  return NextResponse.json({ ok: true, slug });
}
