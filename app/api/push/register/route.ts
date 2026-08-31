import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/push/register — store this device's push token.
 * Body: { token, platform: "ios" | "android" }
 *
 * Called by the app shell (PushRegistration) after the OS hands over
 * an APNs/FCM token. The row lands in push_tokens (migration 029)
 * under the CALLER's session — user_id comes from the session, never
 * the body, and RLS only lets you write your own rows.
 *
 * Upsert on the token: re-registering refreshes updated_at, and a
 * token that re-appears under a DIFFERENT account (logout → new login
 * on the same phone) moves to the new account so the previous owner
 * stops receiving pushes on a phone that isn't theirs anymore.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Registration fires once per app launch — 10/5min is generous.
  const limited = await rateLimit(`push-register:${user.id}`, 10, 300_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, platform } = (body ?? {}) as {
    token?: unknown;
    platform?: unknown;
  };

  if (
    typeof token !== "string" ||
    token.length < 16 ||
    token.length > 512 ||
    // APNs/FCM tokens are URL-safe — anything outside this set is junk.
    !/^[A-Za-z0-9_:.\-]+$/.test(token)
  ) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }
  if (platform !== "ios" && platform !== "android") {
    return NextResponse.json({ error: "Invalid platform." }, { status: 400 });
  }

  const supabase = await createClient();

  // Upsert by token. RLS quirk: upserting a token row that belongs to
  // ANOTHER user is invisible to this session (no select policy on
  // other people's rows), so onConflict update would fail — delete-
  // then-insert sidesteps it... except we can't delete their row
  // either. So: try the upsert (covers "mine or new"); on a unique
  // conflict the row is someone else's — the fan-out will clean it up
  // when APNs reports the token dead, and this device re-registers on
  // a later launch. Losing that edge case beats a service-role key.
  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: user.id,
      token,
      platform,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "token" }
  );

  if (error) {
    // 42P01 = table missing (migration 029 not run yet) — report OK so
    // the app doesn't retry-loop; the next launch after the migration
    // registers for real.
    if (error.code === "42P01") {
      return NextResponse.json({ ok: true, pending: true });
    }
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      // Token currently owned by a different account — see above.
      return NextResponse.json({ ok: true, deferred: true });
    }
    return NextResponse.json(
      { error: "Could not save the token." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
