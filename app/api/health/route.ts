import { NextResponse } from "next/server";
import { geniusConfigured } from "@/lib/genius";

/**
 * GET /api/health
 *
 * Public config sanity check. Reports WHETHER each integration is
 * configured — never the values themselves, so this exposes nothing
 * sensitive. Handy for confirming Vercel env vars actually landed
 * after a deploy.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    genius: geniusConfigured(),
    spotify: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
