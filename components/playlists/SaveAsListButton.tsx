"use client";

/**
 * SaveAsListButton — "turn this Spotify playlist into one of my lists".
 *
 * One POST to /api/lists/from-playlist; the server reads the playlist
 * through Spotify and builds the list + items in the viewer's name.
 * Signed-out viewers get sent to /login (the API would 401 anyway —
 * this just makes the door obvious). On success we land on the new
 * list's edit page so the person can rename, rank, and trim it.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SaveAsListButton({
  playlistId,
  className = "btn-y2k btn-y2k-outline text-xs",
}: {
  playlistId: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lists/from-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlist_id: playlistId }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        editHref?: string;
      };
      if (!res.ok || !data.editHref) {
        setError(data.error || "Couldn't save that playlist.");
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
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className={`${className} disabled:opacity-50`}
      >
        {busy ? "Reading playlist…" : "Save as a list"}
      </button>
      {error && <span className="text-xs text-accent-rose max-w-xs text-right">{error}</span>}
    </span>
  );
}
