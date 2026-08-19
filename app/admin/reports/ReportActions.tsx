"use client";

/**
 * ReportActions — the Resolve / Dismiss / Delete buttons on one
 * report row. Posts to /api/admin/reports/[id] and refreshes the
 * server-rendered queue so the row disappears.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReportActionsProps {
  reportId: string;
  /** Whether this target type supports queue-side content deletion. */
  deletable: boolean;
}

type Action = "resolve" | "dismiss" | "delete_content";

export default function ReportActions({ reportId, deletable }: ReportActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    if (busy) return;
    // Deleting someone's content is the one irreversible action here.
    if (action === "delete_content" && !window.confirm("Delete the reported content? This can't be undone.")) {
      return;
    }
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
      router.refresh(); // re-render the server page → row leaves the queue
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const base =
    "text-[11px] uppercase tracking-wider font-bold rounded px-2 py-1 border transition-colors disabled:opacity-40";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => run("resolve")}
          disabled={!!busy}
          className={`${base} text-osd-green border-osd-green/40 hover:bg-osd-green/10`}
        >
          {busy === "resolve" ? "…" : "Resolve"}
        </button>
        <button
          type="button"
          onClick={() => run("dismiss")}
          disabled={!!busy}
          className={`${base} text-text-muted border-border-medium hover:text-text-primary`}
        >
          {busy === "dismiss" ? "…" : "Dismiss"}
        </button>
        {deletable && (
          <button
            type="button"
            onClick={() => run("delete_content")}
            disabled={!!busy}
            className={`${base} text-accent-rose border-accent-rose/40 hover:bg-accent-rose/10`}
          >
            {busy === "delete_content" ? "…" : "Delete content"}
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-accent-rose">{error}</p>}
    </div>
  );
}
