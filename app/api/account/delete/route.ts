import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * /api/account/delete — permanent, self-serve account deletion.
 *
 *   POST → deletes the signed-in user's account and ALL their
 *          content (reviews, lists, debates, messages, uploads)
 *          via the delete_own_account() SECURITY DEFINER RPC
 *          (migration 014), then clears the auth session.
 *
 * Required by App Store guideline 5.1.1(v): account creation in
 * the app means account deletion must be possible in the app.
 * No body, no params — the RPC only ever acts on auth.uid().
 */

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Deletion is irreversible — a tight limit still leaves room for
  // a retry after a transient failure.
  const limited = rateLimit(`account-delete:${user.id}`, 3, 3_600_000);
  if (limited) return limited;

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    console.error("account deletion failed:", error);
    return NextResponse.json(
      { error: "Could not delete the account. Try again or contact support." },
      { status: 500 }
    );
  }

  // The auth user is gone; drop the now-orphaned session cookies.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
