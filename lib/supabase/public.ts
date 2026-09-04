/**
 * A Supabase client with NO cookies attached — for public catalog reads
 * that are identical for every visitor.
 *
 * Why this exists: `lib/supabase/server.ts` reads `cookies()` so it can
 * carry the viewer's session. That's correct for anything viewer-specific,
 * but it has two costs on public data:
 *
 *   1. `cookies()` cannot be called inside `unstable_cache` — Next throws.
 *      So any query that touches the cookie client can never be cached.
 *   2. Every render re-runs the query against Supabase even though the
 *      answer is the same bytes for everyone.
 *
 * The homepage was paying both: ~16 Supabase round-trips per render on a
 * `force-dynamic` route, which by 2026-09-04 was burning ~3h of Vercel's
 * 4h/month Fluid Active CPU allowance on its own (see ROADMAP).
 *
 * Anything read through this client is anonymous — RLS applies exactly as
 * it does for a logged-out visitor. Never use it for viewer-specific data;
 * there is no session here, so "my likes"/"my blocks" would come back
 * empty rather than wrong, but the intent still belongs in server.ts.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

/* One module-level client. It holds no per-request state (no cookies, no
   session), so it is safe to share across requests and saves rebuilding
   the client on every call. */
const client = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // No session to persist or refresh — this client is never signed in.
    persistSession: false,
    autoRefreshToken: false,
  },
});

/** The cookie-less anon client. Public catalog reads only. */
export function publicClient() {
  return client;
}
