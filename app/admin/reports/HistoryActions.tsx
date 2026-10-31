"use client";

/**
 * HistoryActions — the undo buttons on a HISTORY row (Luca 2026-10-30:
 * "what if i accidentally deleted something that actually wasnt an
 * issue").
 *
 *   Restore — only on rows whose content was deleted with a copy kept
 *             (migration 069). Puts it back exactly as it was —
 *             comments, likes and all — and marks the report dismissed.
 *   Reopen  — sends the report back to the open queue to decide again.
 *             Doesn't bring deleted content back (that's Restore).
 *
 * Both post to /api/admin/reports/[id], same as the queue buttons.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "restore" | "reopen";

export default function HistoryActions({
  reportId,
  restorable,
}: {
  reportId: string;
  /** Deleted with a copy kept, and not put back yet. */
  restorable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    if (busy) return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      // Re-render: a reopened row moves up into the queue; a restored
      // one flips to "Restored".
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const base =
    "text-[11px] uppercase tracking-wider font-bold rounded px-2 py-1 border transition-colors disabled:opacity-40";

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <div className="flex gap-2">
        {restorable && (
          <button
            type="button"
            onClick={() => run("restore")}
            disabled={!!busy}
            className={`${base} text-accent-primary border-accent-primary/40 hover:bg-accent-primary/10`}
          >
            {busy === "restore" ? "…" : "Restore"}
          </button>
        )}
        <button
          type="button"
          onClick={() => run("reopen")}
          disabled={!!busy}
          className={`${base} text-text-muted border-border-medium hover:text-text-primary`}
        >
          {busy === "reopen" ? "…" : "Reopen"}
        </button>
      </div>
      {error && <p className="text-[11px] text-accent-rose max-w-56 text-right">{error}</p>}
    </div>
  );
}
