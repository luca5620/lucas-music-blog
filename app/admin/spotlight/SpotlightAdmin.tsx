"use client";

/**
 * SpotlightAdmin — the working half of /admin/spotlight.
 * Album link + Monday + note → POST /api/admin/spotlight; the list
 * below shows what's live, what's coming and the last few weeks, each
 * removable (DELETE). Errors come back from the route written to show.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface AdminWeek {
  id: string;
  weekStart: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  title: string;
  slug: string;
}

/** The Monday of the week we're in (today if it's Monday), as YYYY-MM-DD. */
function thisMonday(): string {
  const d = new Date();
  const back = (d.getDay() + 6) % 7; // Mon → 0 … Sun → 6
  d.setDate(d.getDate() - back);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function status(w: AdminWeek, now: number): "Live" | "Coming" | "Done" {
  if (new Date(w.startsAt).getTime() > now) return "Coming";
  if (new Date(w.endsAt).getTime() <= now) return "Done";
  return "Live";
}

export default function SpotlightAdmin({ initialWeeks }: { initialWeeks: AdminWeek[] }) {
  const router = useRouter();
  const [release, setRelease] = useState("");
  const [week, setWeek] = useState(thisMonday);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  // Read once per render of the list — fine for a staff tool.
  const [now] = useState(() => Date.now());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !release.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ release: release.trim(), week_start: week, note: note.trim() || null }),
      });
      const data = (await res.json()) as { error?: string; title?: string; week_start?: string };
      if (!res.ok) {
        setResult({ ok: false, text: data.error ?? "Something went wrong." });
      } else {
        setResult({ ok: true, text: `${data.title} is the spotlight for the week of ${data.week_start}.` });
        setRelease("");
        setNote("");
        router.refresh();
      }
    } catch {
      setResult({ ok: false, text: "Network hiccup — try again." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/spotlight", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setResult({ ok: false, text: data.error ?? "Couldn't remove it." });
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full bg-black/40 border border-border-subtle rounded px-3 py-2 text-sm focus:outline-none focus:border-accent-primary";

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="panel-xbox p-6 space-y-5">
        <div className="space-y-2">
          <label htmlFor="spot-release" className="label-xbox inline-flex">
            Album link
          </label>
          <input
            id="spot-release"
            type="text"
            value={release}
            onChange={(e) => setRelease(e.target.value)}
            placeholder="peakmusicreviews.com/releases/…"
            autoComplete="off"
            className={field}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="spot-week" className="label-xbox inline-flex">
            Week starting (Monday)
          </label>
          <input
            id="spot-week"
            type="date"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className={field}
          />
          <p className="text-xs text-text-muted">Any day works — it snaps to that week&apos;s Monday.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="spot-note" className="label-xbox inline-flex">
            Why this one (optional)
          </label>
          <textarea
            id="spot-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="One line, shown in quotes on the home page"
            className={field}
          />
          <p className="text-xs text-text-muted text-right">{note.length}/280</p>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={busy || !release.trim()} className="btn-y2k disabled:opacity-40">
            {busy ? "Saving…" : "Set spotlight"}
          </button>
          {result && (
            <p className={`text-sm ${result.ok ? "text-accent-primary" : "text-red-400"}`}>{result.text}</p>
          )}
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="label-xbox inline-flex">Weeks</h2>
        {initialWeeks.length === 0 ? (
          <p className="text-sm text-text-muted">No spotlight picked yet.</p>
        ) : (
          <ul className="space-y-2">
            {initialWeeks.map((w) => {
              const s = status(w, now);
              return (
                <li key={w.id} className="flex items-center gap-3 border-b border-border-subtle py-2">
                  <span
                    className={`pixel-text text-xs w-16 shrink-0 ${
                      s === "Live" ? "text-osd-green" : s === "Coming" ? "text-osd-amber" : "text-text-muted"
                    }`}
                  >
                    {s.toUpperCase()}
                  </span>
                  <span className="text-xs text-text-muted w-24 shrink-0 tabular-nums">{w.weekStart}</span>
                  <Link href={`/releases/${w.slug}`} className="text-sm font-bold truncate flex-1 hover:text-accent-primary">
                    {w.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(w.id)}
                    disabled={busy}
                    className="text-xs text-text-muted hover:text-red-400 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
