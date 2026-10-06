import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isLocale } from "@/i18n/config";
import { requestLocale } from "@/i18n/resolve";

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
 *
 * LANGUAGE (migration 052): the row also records which of the six site
 * languages this device speaks, read from the same `pmr-lang` cookie
 * the pages render with (i18n/resolve.ts) — the WebView keeps that
 * cookie like Safari does. Registration runs on EVERY app launch, so
 * the stored language self-corrects at the next launch at the latest;
 * PATCH below makes it immediate when someone switches language.
 * push-fanout + push-recap pick their copy by it.
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

  const locale = await requestLocale();
  const supabase = await createClient();

  // Upsert by token. RLS quirk: upserting a token row that belongs to
  // ANOTHER user is invisible to this session (no select policy on
  // other people's rows), so onConflict update would fail — delete-
  // then-insert sidesteps it... except we can't delete their row
  // either. So: try the upsert (covers "mine or new"); on a unique
  // conflict the row is someone else's — the fan-out will clean it up
  // when APNs reports the token dead, and this device re-registers on
  // a later launch. Losing that edge case beats a service-role key.
  const row = {
    user_id: user.id,
    token,
    platform,
    locale,
    updated_at: new Date().toISOString(),
  };
  let { error } = await supabase
    .from("push_tokens")
    .upsert(row as never, { onConflict: "token" });

  // 42703 / PGRST204 = "no such column": migration 052 (which adds
  // `locale`) hasn't been run yet. Save the token without it rather
  // than losing the device — it picks up a language on a later launch.
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    const { locale: _skip, ...withoutLocale } = row;
    void _skip;
    ({ error } = await supabase
      .from("push_tokens")
      .upsert(withoutLocale as never, { onConflict: "token" }));
  }

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

/**
 * PATCH /api/push/register — "I just switched language."
 * Body: { locale }  (one of the six — validated against i18n/config)
 *
 * The language picker calls this inside the app right after it writes
 * the new cookie, so the very next push already speaks the new
 * language instead of waiting for the next app launch to re-register.
 *
 * It updates ALL of the caller's devices: the picker doesn't know this
 * device's token (only the native layer does). If someone runs two
 * phones in two languages, the other phone flips too — and flips back
 * on its own next launch, when POST re-registers it with its own
 * cookie. RLS limits the update to the caller's own rows regardless.
 */
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A language switch is a rare, deliberate act — 10 per 5 minutes is
  // a lot of indecision.
  const limited = await rateLimit(`push-locale:${user.id}`, 10, 300_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { locale } = (body ?? {}) as { locale?: unknown };
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_tokens")
    .update({ locale, updated_at: new Date().toISOString() } as never)
    .eq("user_id", user.id);

  if (error) {
    // Before migration 052 there's no locale column — nothing to save,
    // and nothing the caller can do about it, so don't call it an error.
    if (error.code === "42703" || error.code === "PGRST204") {
      return NextResponse.json({ ok: true, pending: true });
    }
    return NextResponse.json(
      { error: "Could not save the language." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
