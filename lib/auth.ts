import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

/**
 * Get the currently authenticated user (server-side).
 * Returns null if not logged in.
 *
 * Wrapped in React's `cache()`, which dedupes by arguments for the
 * duration of a single request render. `supabase.auth.getUser()` is a
 * network round-trip to Supabase Auth (it verifies the JWT server-side,
 * it doesn't just decode the cookie), and the same page often asks
 * "who's watching?" from several components — the page itself, the
 * blocked-list helper, a feed section. Before this, each of those paid
 * for its own round-trip; now the first call pays and the rest are free.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Get the current user's profile from the profiles table.
 * Returns null if not logged in or profile not found.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

/**
 * Require authentication — redirects to /login if not signed in.
 * Use at the top of protected server components / pages.
 */
export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
