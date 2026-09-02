"use client";

/**
 * PlaylistImportBox — the paste-a-Spotify-playlist slot on /lists/new.
 *
 * Instead of searching records one by one, drop a playlist link and
 * the list is built from it (server reads the playlist, items land
 * with title / artist / cover). Live feedback on the pasted link,
 * then the same /api/lists/from-playlist door SaveAsListButton uses.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parsePlaylistUrl } from "@/lib/playlist";

export default function PlaylistImportBox() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = url.trim();
  const playlistId = trimmed ? parsePlaylistUrl(trimmed) : null;
  const invalid = trimmed.length > 0 && !playlistId;

  async function importPlaylist() {
    if (!playlistId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lists/from-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlist_id: playlistId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        editHref?: string;
      };
      if (!res.ok || !data.editHref) {
        setError(data.error || "Couldn't read that playlist.");
        setBusy(false);
        return;
      }
      router.push(data.editHref);
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setBusy(false);
    }
  }

  return (
    <fieldset className="panel-xbox p-5 space-y-3">
      <legend className="label-xbox">Start from a Spotify playlist</legend>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://open.spotify.com/playlist/…"
          className="form-input flex-1"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={importPlaylist}
          disabled={!playlistId || busy}
          className="btn-y2k btn-y2k-primary shrink-0 disabled:opacity-50"
        >
          {busy ? "Reading…" : "Build the list"}
        </button>
      </div>
      {playlistId && !error && (
        <p className="pixel-text text-xs text-accent-primary">
          ✓ Spotify playlist detected — every track becomes a list entry.
        </p>
      )}
      {invalid && (
        <p className="text-xs text-accent-rose">
          Not a Spotify playlist link. Paste an open.spotify.com/playlist/… URL.
        </p>
      )}
      {error && <p className="text-xs text-accent-rose">{error}</p>}
      {!trimmed && (
        <p className="text-xs text-text-muted font-[family-name:var(--font-vt323)]">
          paste a playlist and we build the list for you (first 100 tracks) —
          or skip this and add records one at a time below
        </p>
      )}
    </fieldset>
  );
}
