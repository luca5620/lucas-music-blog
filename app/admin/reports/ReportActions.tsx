"use client";

/**
 * ReportActions — the Resolve / Dismiss / Delete buttons on one
 * report row (plus Remove avatar / Remove banner on profile reports). Posts to /api/admin/reports/[id] and refreshes the
 * server-rendered queue so the row disappears.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReportActionsProps {
  reportId: string;
  /** Whether this target type supports queue-side content deletion. */
  deletable: boolean;
  /** Profile reports only: which images the member currently has, so
      only the buttons that can do something show up. */
  profileImages?: { avatar: boolean; banner: boolean };
}

type Action = "resolve" | "dismiss" | "delete_content" | "remove_avatar" | "remove_banner";

/** The destructive actions and what the confirm box says for each. */
const CONFIRM: Partial<Record<Action, string>> = {
  // Since migration 069 a delete keeps a copy — Restore in the history.
  delete_content: "Delete the reported content? (Restore in the history brings it back if it was a mistake.)",
  remove_avatar: "Delete this member's profile picture (every copy they uploaded)? This can't be undone.",
  remove_banner: "Delete this member's banner (every copy they uploaded)? This can't be undone.",
};

export default function ReportActions({ reportId, deletable, profileImages }: ReportActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    if (busy) return;
    // Deleting someone's content or images can't be undone — confirm.
    const question = CONFIRM[action];
    if (question && !window.confirm(question)) {
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
      // Re-render the server page: a resolved row leaves the queue; a
      // removed image disappears from the row (which stays open).
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
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => run("resolve")}
          disabled={!!busy}
          className={`${base} text-accent-primary border-accent-primary/40 hover:bg-accent-primary/10`}
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
      {profileImages && (profileImages.avatar || profileImages.banner) && (
        <div className="flex gap-2">
          {profileImages.avatar && (
            <button
              type="button"
              onClick={() => run("remove_avatar")}
              disabled={!!busy}
              className={`${base} text-accent-rose border-accent-rose/40 hover:bg-accent-rose/10`}
            >
              {busy === "remove_avatar" ? "…" : "Remove avatar"}
            </button>
          )}
          {profileImages.banner && (
            <button
              type="button"
              onClick={() => run("remove_banner")}
              disabled={!!busy}
              className={`${base} text-accent-rose border-accent-rose/40 hover:bg-accent-rose/10`}
            >
              {busy === "remove_banner" ? "…" : "Remove banner"}
            </button>
          )}
        </div>
      )}
      {error && <p className="text-[11px] text-accent-rose">{error}</p>}
    </div>
  );
}
