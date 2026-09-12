import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { USERNAME_REGEX } from "@/lib/username";
import { getProfileByUsername, getProfileStats } from "@/lib/db/profiles";
import { resolveTheme } from "@/lib/profile-theme";

/**
 * GET /api/profile/summary?u=<username>
 *
 * The hover card's one call (components/ui/UserLink.tsx): the public
 * face of a member — name, avatar, role, theme, tagline — plus the
 * four numbers the profile header leads with (followers, following,
 * reviews, likes). Nothing here is private: it is exactly what the
 * profile page shows any visitor, just in one small JSON.
 *
 * Read-only and anonymous, so the limit is per IP (a page full of
 * usernames can fire a handful of these on hover; 120/min is plenty
 * for a human, cheap to refuse for a scraper). Cached briefly at the
 * edge — counts lagging by a minute on a hover card is fine.
 */
export async function GET(request: NextRequest) {
  const username = (request.nextUrl.searchParams.get("u") ?? "").toLowerCase();
  if (!USERNAME_REGEX.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const limited = await rateLimit(`profile-summary:${ip}`, 120, 60_000);
  if (limited) return limited;

  const profile = await getProfileByUsername(username);
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const stats = await getProfileStats(profile.id);

  return NextResponse.json(
    {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      theme: resolveTheme(profile.theme),
      tagline: profile.tagline ?? null,
      hidden_badges: profile.hidden_badges ?? null,
      stats,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
