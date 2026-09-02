import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addListItem,
  createList,
  deleteList,
  generateUniqueListSlug,
} from "@/lib/db/lists";
import {
  fetchPlaylistSnapshot,
  PlaylistUnavailableError,
} from "@/lib/spotify/playlist";
import { PLAYLIST_ID_RE, playlistUrl } from "@/lib/playlist";
import { rateLimit } from "@/lib/rate-limit";
import { checkContent } from "@/lib/content-filter";

/**
 * POST /api/lists/from-playlist — build one of MY lists out of a
 * Spotify playlist (Luca 2026-09-02).
 *
 * Body: { playlist_id }   (the 22-char id — clients parse the URL with
 *                          lib/playlist.ts before calling)
 *
 * Flow: read the playlist through Spotify (client credentials — no
 * user Spotify login needed), create a PRIVATE list named after it,
 * add one item per track with title / artist / album cover and
 * release_id null (list_items allows it; the poster grid renders
 * from the cover). Private by default so a 100-row import never
 * lands in the community lists rail unreviewed — the person publishes
 * it from the edit page once they've trimmed and ranked it.
 *
 * Returns { editHref } — the list's edit page.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Each import is up to 100 inserts + a Spotify call — 3 per 5 min.
  const limited = await rateLimit(`lists-from-playlist:${user.id}`, 3, 300_000);
  if (limited) return limited;

  let playlistId: string;
  try {
    const body = (await request.json()) as { playlist_id?: unknown };
    if (typeof body.playlist_id !== "string" || !PLAYLIST_ID_RE.test(body.playlist_id)) {
      return NextResponse.json({ error: "Invalid playlist id." }, { status: 400 });
    }
    playlistId = body.playlist_id;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // 1. Read the playlist.
  let snapshot;
  try {
    snapshot = await fetchPlaylistSnapshot(playlistId);
  } catch (err) {
    // PlaylistUnavailableError carries a message written for the
    // person; anything else (token misconfig, network) stays generic
    // and gets logged.
    if (err instanceof PlaylistUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("from-playlist: read failed —", err);
    return NextResponse.json(
      { error: "Spotify didn't answer — try again in a minute." },
      { status: 502 }
    );
  }
  if (snapshot.tracks.length === 0) {
    return NextResponse.json(
      { error: "That playlist has no tracks we can list." },
      { status: 400 }
    );
  }

  // 2. The list. Playlist names are user text from Spotify — run them
  // through the same zero-tolerance filter as typed titles.
  const title = snapshot.name.trim() || "Playlist";
  const description =
    `From the Spotify playlist “${title}”` +
    (snapshot.owner ? ` by ${snapshot.owner}` : "") +
    ` — ${playlistUrl(playlistId)}`;
  const dirty = checkContent(title, snapshot.description ?? "");
  if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });

  const slug = await generateUniqueListSlug(user.id, title);
  const list = await createList({
    user_id: user.id,
    slug,
    title,
    description,
    is_ranked: false,
    is_public: false,
  });
  if (!list) {
    return NextResponse.json({ error: "Failed to create the list." }, { status: 500 });
  }

  // 3. The items — sequential inserts keep positions deterministic.
  // If the very first insert fails (RLS, schema), drop the empty list
  // rather than leave a husk behind.
  let position = 0;
  // Migration 037 stores each track's album id so the item can resolve
  // to a real release on first click. If that column isn't there yet,
  // the first insert fails — fall back to the old shape for the whole
  // import rather than losing the list (the items just stay unlinked,
  // exactly as they were before 037).
  let storeAlbumId = true;
  for (const t of snapshot.tracks) {
    const base = {
      list_id: list.id,
      release_id: null,
      title: t.title,
      artist: t.artist,
      cover_image: t.cover_image,
      note: null,
      position,
    };

    let item = await addListItem(
      storeAlbumId && t.album_spotify_id
        ? { ...base, spotify_album_id: t.album_spotify_id }
        : base
    );

    if (!item && storeAlbumId && t.album_spotify_id) {
      // Could be the missing column — retry once without it, and if
      // THAT works, stop sending it for the rest of the playlist.
      item = await addListItem(base);
      if (item) storeAlbumId = false;
    }

    if (!item && position === 0) {
      await deleteList(list.id);
      return NextResponse.json(
        { error: "Couldn't add the playlist's tracks." },
        { status: 500 }
      );
    }
    if (item) position += 1;
  }

  // Username for the edit URL.
  const supabase = await createClient();
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();
  const username = (profileRow as { username: string } | null)?.username ?? "";

  return NextResponse.json(
    {
      list,
      added: position,
      total: snapshot.total,
      editHref: `/lists/${username}/${list.slug}/edit`,
    },
    { status: 201 }
  );
}
