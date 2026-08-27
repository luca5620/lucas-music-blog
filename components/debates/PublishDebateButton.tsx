"use client";

/**
 * PublishDebateButton — the "put it on air" half of debate drafts
 * (migration 024). Rendered only on a draft debate page, which RLS
 * already restricts to the creator, inside the amber draft banner.
 * One PATCH flips is_published and the refresh re-renders the page
 * as a normal live room.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PublishDebateButton({ debateId }: { debateId: string }) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/debates/${debateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't publish the debate.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something broke.");
      setPublishing(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={handlePublish}
        disabled={publishing}
        className="btn-y2k btn-y2k-primary disabled:opacity-50"
      >
        {publishing ? "PUBLISHING…" : "OPEN THE FLOOR"}
      </button>
      {error && <span className="text-sm text-accent-rose">{error}</span>}
    </span>
  );
}
