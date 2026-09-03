"use client";

/**
 * BlockButton — Block / Unblock another user from their profile.
 *
 * Blocking removes ALL their content from your feeds instantly
 * (the server filters them out and we refresh the route) and
 * auto-files a report so moderators see it — App Store 1.2 wants
 * both. It's private as far as the blocked user is concerned:
 * THEY are never notified.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface BlockButtonProps {
  targetUserId: string;
  targetUsername: string;
  initialBlocked: boolean;
}

export default function BlockButton({
  targetUserId,
  targetUsername,
  initialBlocked,
}: BlockButtonProps) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const t = useTranslations("profile.block");

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/blocks", {
        method: blocked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: targetUserId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("failed"));
      setBlocked(!blocked);
      setConfirming(false);
      // Re-render the server components on this route so the
      // blocked user's content disappears IMMEDIATELY — Apple's
      // 1.2 wording is "remove it from the user's feed instantly".
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  // Unblocking is low-stakes — no confirm step needed.
  if (blocked) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-border-medium text-text-muted hover:text-text-primary hover:border-border-bright transition-colors disabled:opacity-40 font-[family-name:var(--font-heading)]"
      >
        {busy ? "…" : t("unblock")}
      </button>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex flex-col items-end gap-1.5">
        <span className="text-xs text-text-secondary max-w-[16rem] text-right">
          {t("confirm", { username: targetUsername })}
        </span>
        {error && <span className="text-[11px] text-accent-rose">{error}</span>}
        <span className="inline-flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-[11px] uppercase tracking-wider text-text-muted hover:text-text-primary px-2 py-1"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className="text-[11px] uppercase tracking-wider font-bold text-accent-rose border border-accent-rose/40 rounded px-2 py-1 hover:bg-accent-rose/10 disabled:opacity-40 transition-colors"
          >
            {busy ? "…" : t("block")}
          </button>
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-transparent text-text-muted hover:text-accent-rose hover:border-accent-rose/30 transition-colors font-[family-name:var(--font-heading)]"
    >
      {t("block")}
    </button>
  );
}
