"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

/**
 * DeleteAccountSection — the settings-page danger zone.
 *
 * App Store guideline 5.1.1(v): an app with account creation must
 * offer account DELETION inside the app — "email us" doesn't pass
 * review. This is that switch: two steps (open, then type the
 * username) because it's the one action on the site with no undo.
 *
 * Calls POST /api/account/delete → delete_own_account() RPC
 * (migration 014), which wipes the auth user and cascades through
 * every content table, then hard-reloads to a signed-out home page.
 */

export default function DeleteAccountSection({
  username,
}: {
  username: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // LANGUAGES: messages → settings.deletion. The API's own error text
  // (if it sends one) is shown as-is.
  const t = useTranslations("settings.deletion");

  const armed = confirmText.trim().toLowerCase() === username.toLowerCase();

  const handleDelete = async () => {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? t("failed"));
      }
      // Server session is gone — clear the client copy too, then a
      // hard reload so every auth-aware component starts signed out.
      try {
        await createClient().auth.signOut();
      } catch {
        /* the account no longer exists — a signOut error is expected */
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
      setBusy(false);
    }
  };

  // No panel or title of its own: the Settings page wraps this in a
  // collapsible SettingsSection (rose-tinted) that carries both
  // (2026-09-03).
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary leading-relaxed">
        {t.rich("intro", {
          b: (chunks) => <strong className="text-text-primary">{chunks}</strong>,
        })}
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-y2k btn-y2k-outline !border-accent-rose !text-accent-rose"
        >
          {t("delete")}
        </button>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm text-text-secondary">
            {t.rich("typeUsername", {
              b: () => <span className="font-bold text-text-primary">@{username}</span>,
            })}
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={username}
            autoComplete="off"
            className="w-full max-w-xs px-3 py-2 rounded-lg bg-black/40 border border-border-medium text-text-primary text-sm focus:outline-none focus:border-accent-rose"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!armed || busy}
              className="btn-y2k !bg-accent-rose !border-accent-rose !text-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? t("deleting") : t("forever")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
              }}
              disabled={busy}
              className="btn-y2k btn-y2k-outline"
            >
              {t("cancel")}
            </button>
          </div>
          {error && (
            <p className="text-sm text-accent-rose font-bold">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
