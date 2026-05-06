"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

interface ImportSuccess {
  ok: true;
  kind: "artist" | "album";
  id: string;
  slug: string;
  name?: string;
  title?: string;
}

interface ImportError {
  error: string;
}

interface HistoryEntry {
  kind: "artist" | "album";
  slug: string;
  label: string;
  href: string;
  at: number;
}

const HISTORY_LIMIT = 5;

function buildHref(kind: "artist" | "album", slug: string): string {
  return kind === "artist" ? `/artists/${slug}` : `/releases/${slug}`;
}

export default function AdminImportForm() {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Paste a Spotify URL first.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyUrl: trimmed }),
      });
      const data = (await res.json()) as ImportSuccess | ImportError;

      if (!res.ok || !("ok" in data)) {
        const msg = "error" in data ? data.error : `HTTP ${res.status}`;
        setError(msg);
        return;
      }

      const label = data.title ?? data.name ?? data.slug;
      const entry: HistoryEntry = {
        kind: data.kind,
        slug: data.slug,
        label,
        href: buildHref(data.kind, data.slug),
        at: Date.now(),
      };
      setLatest(entry);
      setHistory((prev) =>
        [entry, ...prev.filter((p) => p.href !== entry.href)].slice(
          0,
          HISTORY_LIMIT
        )
      );
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="panel-xbox-glow p-6 space-y-4">
        <label className="block">
          <span className="label-xbox mb-2 inline-flex">Spotify URL</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://open.spotify.com/album/... or /artist/..."
            disabled={pending}
            className="w-full rounded-md bg-black/40 border border-[rgba(30,144,255,0.3)] px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[rgba(30,144,255,0.7)] focus:ring-1 focus:ring-[rgba(30,144,255,0.5)] disabled:opacity-50"
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="btn-y2k btn-y2k-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Importing..." : "Import"}
          </button>
          {pending && (
            <span className="text-xs opacity-60 pixel-text">
              Talking to Spotify...
            </span>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-400 border border-red-500/40 bg-red-500/10 rounded px-3 py-2">
            {error}
          </div>
        )}
      </form>

      {latest && (
        <div className="panel-xbox p-5">
          <span className="label-xbox mb-2 inline-flex">Imported OK</span>
          <div className="pixel-text text-lg font-semibold mb-1">
            {latest.label}
          </div>
          <div className="text-xs opacity-60 mb-3">
            {latest.kind} · /{latest.slug}
          </div>
          <Link
            href={latest.href}
            className="btn-y2k btn-y2k-outline text-xs"
          >
            View {latest.kind} page →
          </Link>
        </div>
      )}

      {history.length > 0 && (
        <div className="panel-xbox p-5">
          <span className="label-xbox mb-3 inline-flex">
            Recent (this session)
          </span>
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li
                key={`${h.href}-${h.at}`}
                className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0"
              >
                <Link
                  href={h.href}
                  className="hover:text-[rgb(77,172,255)] truncate"
                >
                  <span className="opacity-50 mr-2 text-xs uppercase">
                    {h.kind}
                  </span>
                  {h.label}
                </Link>
                <span className="text-xs opacity-40 shrink-0 pixel-text">
                  /{h.slug}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
