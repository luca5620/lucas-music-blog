"use client";

/**
 * ChangePasswordSection — Settings block for picking a new password
 * while signed in. Supabase authorizes the change by the live
 * session, so there's no "current password" field — anyone far
 * enough in to see Settings is already authenticated.
 */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordSection() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNote(null);
    if (password.length < 6) {
      setNote({ ok: false, text: "At least 6 characters." });
      return;
    }
    if (password !== confirm) {
      setNote({ ok: false, text: "The two entries don't match." });
      return;
    }
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setNote({
        ok: false,
        text: /different from the old/i.test(error.message)
          ? "That's already your password — pick a new one."
          : error.message,
      });
    } else {
      setPassword("");
      setConfirm("");
      setNote({ ok: true, text: "Password changed. ✓" });
    }
    setSaving(false);
  };

  // No panel or title of its own: the Settings page wraps this in a
  // collapsible SettingsSection that carries both (2026-09-03).
  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Pick a new one — takes effect immediately, everywhere
        you&apos;re signed in.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <div>
          <label
            htmlFor="settings-new-password"
            className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
          >
            New password
          </label>
          <input
            id="settings-new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="form-input"
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label
            htmlFor="settings-confirm-password"
            className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
          >
            Repeat it
          </label>
          <input
            id="settings-confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            className="form-input"
            placeholder="Same thing again"
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-center gap-4">
          {/* Bare .btn-y2k is transparent (looked like plain text) —
              Luca 2026-08-31: make it an actual visible button. */}
          <button
            type="submit"
            disabled={saving}
            className="btn-y2k btn-y2k-primary disabled:opacity-50"
          >
            {saving ? "Saving…" : "Change password"}
          </button>
          {note && (
            <p
              className={`text-sm ${note.ok ? "text-accent-primary" : "text-red-400"}`}
            >
              {note.text}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
