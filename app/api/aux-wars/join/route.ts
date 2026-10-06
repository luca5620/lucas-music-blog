import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isSafeSlug } from "@/lib/validate";
import { readJson } from "@/lib/aux-wars/guard";

/**
 * POST /api/aux-wars/join — enter a private room's code.
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
    const msg = error?.message ?? "";
    // Wrong code → 403, and it rightly costs one of the 10 tries.
    if (/BAD_CODE/.test(msg)) {
      return NextResponse.json(
        { error: "That code doesn't open this room." },
        { status: 403 }
      );
    }
    // The code was RIGHT but the host removed this person from the
    // room (aux_bans). This used to fall through to the generic 500
    // "try again" below — so the person kept retrying a correct code
    // and burned their whole 10-per-10-minutes budget on something no
    // retry can ever fix. A clear, final 403 instead.
    if (/BANNED/.test(msg)) {
      return NextResponse.json(
        { error: "The host removed you from this room, so you can't rejoin it." },
        { status: 403 }
      );
    }
    if (error) console.error("aux join-with-code failed:", msg);
    return NextResponse.json({ error: "Couldn't join. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, slug });
}
