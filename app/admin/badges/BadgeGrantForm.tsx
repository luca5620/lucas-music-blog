"use client";

/**
 * BadgeGrantForm — the working half of /admin/badges.
 * Username + badge radio list (live RoleBadge previews) → POST
 * /api/admin/badge. Errors come straight from the grant_badge RPC,
 * which writes them to be shown (unknown user, ungrantable badge…).
 */

import { useState } from "react";
import RoleBadge from "@/components/ui/RoleBadge";

const BADGES = [
  {
    value: "reviewer",
    name: "Verified Reviewer",
    note: "Green check. Badge only, no extra powers.",
  },
  {
    value: "tester",
    name: "Early Tester",
    note: "Purple glow — the day-one crew. Badge only.",
  },
  {
    value: "admin",
    name: "Admin",
    note: "Blue glow — ALSO grants staff powers (report queue, imports).",
  },
  {
    value: "user",
    name: "No badge",
    note: "Back to a regular user. Removes any badge and admin powers.",
  },
] as const;

type BadgeValue = (typeof BADGES)[number]["value"];

export default function BadgeGrantForm() {
  const [username, setUsername] = useState("");
  const [badge, setBadge] = useState<BadgeValue>("reviewer");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !username.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/badge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), role: badge }),
      });
      const data = (await res.json()) as { error?: string; username?: string };
      if (!res.ok) {
        setResult({ ok: false, text: data.error ?? "Something went wrong." });
      } else {
        const picked = BADGES.find((b) => b.value === badge);
        setResult({
          ok: true,
          text:
            badge === "user"
              ? `@${data.username} is back to a regular user.`
              : `@${data.username} now wears ${picked?.name}.`,
        });
      }
    } catch {
      setResult({ ok: false, text: "Network hiccup — try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel-xbox p-6 space-y-5">
      <div className="space-y-2">
        <label htmlFor="badge-username" className="label-xbox inline-flex">
          Username
        </label>
        <input
          id="badge-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="who gets it?"
          maxLength={30}
          autoComplete="off"
          className="w-full bg-black/40 border border-border-subtle rounded px-3 py-2 text-sm focus:outline-none focus:border-accent-primary"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="label-xbox inline-flex mb-2">Badge</legend>
        {BADGES.map((b) => (
          <label
            key={b.value}
            className={`flex items-center gap-3 rounded border px-3 py-2 cursor-pointer transition-colors ${
              badge === b.value
                ? "border-accent-primary bg-accent-primary/10"
                : "border-border-subtle hover:border-border-medium"
            }`}
          >
            <input
              type="radio"
              name="badge"
              value={b.value}
              checked={badge === b.value}
              onChange={() => setBadge(b.value)}
              className="accent-[var(--accent-primary)]"
            />
            {b.value !== "user" && <RoleBadge role={b.value} size="sm" />}
            <span className="text-sm font-bold">{b.name}</span>
            <span className="text-xs text-text-muted ml-auto text-right">
              {b.note}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy || !username.trim()}
          className="btn-y2k disabled:opacity-40"
        >
          {busy ? "Granting…" : "Grant badge"}
        </button>
        {result && (
          <p
            className={`text-sm ${
              result.ok ? "text-accent-primary" : "text-red-400"
            }`}
          >
            {result.text}
          </p>
        )}
      </div>
    </form>
  );
}
