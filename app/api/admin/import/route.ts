import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sessionUsedEmailCode } from "@/lib/auth/amr";
import { parseSpotifyUrl } from "@/lib/spotify/auth";
import {
  importArtistFromSpotify,
  importReleaseFromSpotify,
  importReleaseFromTrack,
} from "@/lib/spotify-import";
import type { Profile } from "@/lib/types/database";

interface ImportBodyByUrl {
  spotifyUrl: string;
}
interface ImportBodyByKind {
  kind: "artist" | "album" | "track";
  spotifyId: string;
}
type ImportBody = Partial<ImportBodyByUrl & ImportBodyByKind>;

function isSpotifyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Spotify\s+\d{3}/i.test(msg) || /Spotify\s+(artist|album)\s+not\s+found/i.test(msg);
}

export async function POST(request: Request) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Role check
  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as Pick<Profile, "role"> | null)?.role;
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2b. Email-code gate — staff sessions must have gone through the
  // emailed code, not just a password (see lib/auth/amr.ts).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!sessionUsedEmailCode(session?.access_token)) {
    return NextResponse.json(
      { error: "Sign in again with your email code to use admin tools." },
      { status: 403 }
    );
  }

  // 3. Parse body
  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let kind: "artist" | "album" | "track";
  let spotifyId: string;

  if (body.spotifyUrl) {
    const parsed = parseSpotifyUrl(body.spotifyUrl);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "Could not parse Spotify URL. Expected an artist, album, or track link.",
        },
        { status: 400 }
      );
    }
    kind = parsed.kind;
    spotifyId = parsed.id;
  } else if (body.kind && body.spotifyId) {
    if (body.kind !== "artist" && body.kind !== "album" && body.kind !== "track") {
      return NextResponse.json(
        { error: "kind must be 'artist', 'album', or 'track'" },
        { status: 400 }
      );
    }
    kind = body.kind;
    spotifyId = body.spotifyId;
  } else {
    return NextResponse.json(
      { error: "Provide either spotifyUrl or {kind, spotifyId}" },
      { status: 400 }
    );
  }

  // 4. Run import
  try {
    if (kind === "artist") {
      const artist = await importArtistFromSpotify(spotifyId);
      return NextResponse.json({
        ok: true,
        kind,
        id: artist.id,
        slug: artist.slug,
        name: artist.name,
      });
    } else if (kind === "track") {
      // Track URLs resolve to their parent release.
      const release = await importReleaseFromTrack(spotifyId);
      return NextResponse.json({
        ok: true,
        kind: "album", // we returned a release, regardless of input kind
        resolvedFrom: "track",
        id: release.id,
        slug: release.slug,
        title: release.title,
      });
    } else {
      const release = await importReleaseFromSpotify(spotifyId);
      return NextResponse.json({
        ok: true,
        kind,
        id: release.id,
        slug: release.slug,
        title: release.title,
      });
    }
  } catch (err) {
    // Log the full error server-side; return a generic message so DB /
    // Spotify internals never leak to the client.
    console.error("Admin import failed:", err);
    const status = isSpotifyError(err) ? 502 : 500;
    const message = isSpotifyError(err)
      ? "Spotify request failed — check the URL and try again."
      : "Import failed.";
    return NextResponse.json({ error: message }, { status });
  }
}
