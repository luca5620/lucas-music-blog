/**
 * GET /api/now-playing
 *
 * Returns the currently playing track, or the most recently played track
 * if nothing is active. The frontend polls this every 30 seconds.
 */
import { NextResponse } from "next/server";
import { getNowPlaying, getRecentlyPlayed } from "@/lib/spotify";

export const dynamic = "force-dynamic"; /* Never cache this route */

export async function GET() {
  try {
    /* Check if the refresh token is configured */
    if (!process.env.SPOTIFY_REFRESH_TOKEN) {
      return NextResponse.json({
        isPlaying: false,
        isConfigured: false,
        message: "Spotify not connected yet",
      });
    }

    /* Try to get the currently playing track */
    const nowPlaying = await getNowPlaying();

    if (nowPlaying) {
      return NextResponse.json({
        ...nowPlaying,
        isConfigured: true,
        type: "now-playing",
      });
    }

    /* Fallback: get the most recently played track */
    const recentlyPlayed = await getRecentlyPlayed();

    if (recentlyPlayed) {
      return NextResponse.json({
        ...recentlyPlayed,
        isConfigured: true,
        type: "recently-played",
      });
    }

    /* Nothing found at all */
    return NextResponse.json({
      isPlaying: false,
      isConfigured: true,
      type: "none",
      message: "No recent listening data",
    });
  } catch (error) {
    console.error("Spotify API error:", error);
    return NextResponse.json(
      {
        isPlaying: false,
        isConfigured: true,
        type: "error",
        message: "Failed to fetch Spotify data",
      },
      { status: 500 }
    );
  }
}
