"use client";

/**
 * Two-step delete for a list, for the manage hub (/reviews/mine).
 * The list editor has its own Danger Zone; this is the compact
 * in-row version. Errors show in place (the 038 lesson — a delete
 * that quietly does nothing must never look like success; the API
 * reports zero deleted rows as a 403 with a real message).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  listId: string;
  listTitle: string;
}

export default function DeleteListButton({ listId, listTitle }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Couldn't delete it.");
    } catch {
      setError("Network hiccup — try again.");
    }
    setDeleting(false);
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-[#9a9a9e] font-[family-name:var(--font-vt323)]">
          Delete &quot;{listTitle}&quot;?
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-2 py-0.5 rounded text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors font-[family-name:var(--font-heading)] uppercase tracking-wider disabled:opacity-50"
        >
          {deleting ? "..." : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-0.5 rounded text-xs font-bold text-[#9a9a9e] hover:text-[#e8e6e3] transition-colors font-[family-name:var(--font-heading)] uppercase tracking-wider"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-accent-rose hover:bg-accent-rose/10 transition-colors font-[family-name:var(--font-heading)]"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Delete
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
