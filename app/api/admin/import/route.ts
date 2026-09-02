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
import {
  importReleaseManually,
  type ManualImportInput,
} from "@/lib/manual-import";

interface ImportBodyByUrl {
  spotifyUrl: string;
}
interface ImportBodyByKind {
  kind: "artist" | "album" | "track";
  spotifyId: string;
}
/** Manual tab (Luca 2026-09-02): a release typed in by hand because
    neither Spotify nor Genius has it. See lib/manual-import.ts. */
interface ImportBodyManual {
  manual: ManualImportInput;
}
type ImportBody = Partial<
  ImportBodyByUrl & ImportBodyByKind & ImportBodyManual
>;

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

  // 3b. Manual import — no Spotify involved. Field validation lives in
  // importReleaseManually; its thrown messages are written for staff
  // and safe to echo back (this route is owner/admin + code-gated).
  if (body.manual) {
    const m = body.manual;
    try {
      const release = await importReleaseManually({
        title: String(m.title ?? ""),
        artist_id: typeof m.artist_id === "string" ? m.artist_id : null,
        artist_name: typeof m.artist_name === "string" ? m.artist_name : null,
        release_type: m.release_type,
        release_date: m.release_date ? String(m.release_date) : null,
        cover_image: m.cover_image ? String(m.cover_image) : null,
        tracks: Array.isArray(m.tracks) ? m.tracks.map(String) : [],
        is_unreleased: m.is_unreleased === true,
        description: m.description ? String(m.description) : null,
      });
      return NextResponse.json({
        ok: true,
        kind: "album",
        resolvedFrom: "manual",
        id: release.id,
        slug: release.slug,
        title: release.title,
      });
    } catch (err) {
      console.error("Manual import failed:", err);
      const message = err instanceof Error ? err.message : "Import failed.";
      // "upsertRelease failed: …" = database; everything else is one
      // of the validation lines (missing title, bad date…).
      const status = /failed:/i.test(message) ? 500 : 400;
      return NextResponse.json({ error: message }, { status });
    }
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
      { error: "Provide spotifyUrl, {kind, spotifyId}, or a manual release" },
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
