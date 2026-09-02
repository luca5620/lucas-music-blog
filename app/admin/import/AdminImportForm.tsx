"use client";

/**
 * AdminImportForm — two tabs into /api/admin/import.
 *
 *  SPOTIFY LINK  paste an artist / album / track URL → the Spotify
 *                importer (lib/spotify-import.ts).
 *  MANUAL        type a release in by hand (lib/manual-import.ts) —
 *                the door for the "can't find it? email us" note on
 *                the write-a-review page (Luca 2026-09-02). Records
 *                that live only on Bandcamp, private presses, regional
 *                catalogs: title, artist, type, date, cover URL, one
 *                track per line. The result is a normal release row
 *                (source = manual) with its own page.
 *
 * Both tabs share the result + history panels below.
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { Release } from "@/lib/types/database";

/** Mirrors RELEASE_TYPES in lib/manual-import.ts — duplicated here
    because that module pulls in the server-only Supabase client and
    this is a client component. */
const RELEASE_TYPES: Release["release_type"][] = [
  "album",
  "EP",
  "single",
  "mixtape",
  "compilation",
];

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

type Tab = "spotify" | "manual";

const HISTORY_LIMIT = 5;

function buildHref(kind: "artist" | "album", slug: string): string {
  return kind === "artist" ? `/artists/${slug}` : `/releases/${slug}`;
}

const inputClass =
  "w-full rounded-md bg-black/40 border border-[rgba(30,144,255,0.3)] px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[rgba(30,144,255,0.7)] focus:ring-1 focus:ring-[rgba(30,144,255,0.5)] disabled:opacity-50";

export default function AdminImportForm() {
  const [tab, setTab] = useState<Tab>("spotify");

  // --- Spotify tab ---
  const [input, setInput] = useState("");

  // --- Manual tab ---
  const [mTitle, setMTitle] = useState("");
  const [mArtist, setMArtist] = useState("");
  const [mType, setMType] = useState<Release["release_type"]>("album");
  const [mDate, setMDate] = useState("");
  const [mCover, setMCover] = useState("");
  const [mTracks, setMTracks] = useState("");
  const [mUnreleased, setMUnreleased] = useState(false);
  const [mDescription, setMDescription] = useState("");

  // --- Shared ---
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  /** POST the body, record the result. Shared by both tabs. */
  async function runImport(body: unknown): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ImportSuccess | ImportError;

      if (!res.ok || !("ok" in data)) {
        const msg = "error" in data ? data.error : `HTTP ${res.status}`;
        setError(msg);
        return false;
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function handleSpotifySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Paste a Spotify URL first.");
      return;
    }
    const ok = await runImport({ spotifyUrl: trimmed });
    if (ok) setInput("");
  }

  async function handleManualSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!mTitle.trim() || !mArtist.trim()) {
      setError("Title and artist are required.");
      return;
    }
    const ok = await runImport({
      manual: {
        title: mTitle.trim(),
        artist_name: mArtist.trim(),
        release_type: mType,
        release_date: mDate || null,
        cover_image: mCover.trim() || null,
        tracks: mTracks
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean),
        is_unreleased: mUnreleased,
        description: mDescription.trim() || null,
      },
    });
    if (ok) {
      setMTitle("");
      setMDate("");
      setMCover("");
      setMTracks("");
      setMDescription("");
      setMUnreleased(false);
      // Artist + type stay — the next record from the same email is
      // usually the same artist.
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
  }

  return (
    <div className="space-y-6">
      {/* Tab strip */}
      <div className="flex gap-2">
        {(
          [
            ["spotify", "Spotify link"],
            ["manual", "Manual (not on Spotify)"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={`label-xbox px-3 py-1.5 rounded border transition-colors ${
              tab === key
                ? "border-[rgba(30,144,255,0.7)] text-white bg-[rgba(30,144,255,0.12)]"
                : "border-white/10 text-white/50 hover:text-white/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "spotify" ? (
        <form onSubmit={handleSpotifySubmit} className="panel-xbox-glow p-6 space-y-4">
          <label className="block">
            <span className="label-xbox mb-2 inline-flex">Spotify URL</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://open.spotify.com/album/... or /artist/... or /track/..."
              disabled={pending}
              className={inputClass}
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
      ) : (
        <form onSubmit={handleManualSubmit} className="panel-xbox-glow p-6 space-y-4">
          <p className="text-xs opacity-60">
            For records neither Spotify nor Genius has. Check the search on
            /reviews/new first — if it&apos;s there, don&apos;t duplicate it.
            The artist is matched by exact name to an existing artist row
            when one exists, otherwise created.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block sm:col-span-2">
              <span className="label-xbox mb-2 inline-flex">Title *</span>
              <input
                type="text"
                value={mTitle}
                onChange={(e) => setMTitle(e.target.value)}
                disabled={pending}
                className={inputClass}
                maxLength={200}
                required
              />
            </label>

            <label className="block">
              <span className="label-xbox mb-2 inline-flex">Artist *</span>
              <input
                type="text"
                value={mArtist}
                onChange={(e) => setMArtist(e.target.value)}
                disabled={pending}
                className={inputClass}
                placeholder="Exact name — matches an existing artist if spelled the same"
                maxLength={200}
                required
              />
            </label>

            <label className="block">
              <span className="label-xbox mb-2 inline-flex">Type</span>
              <select
                value={mType}
                onChange={(e) => setMType(e.target.value as Release["release_type"])}
                disabled={pending}
                className={inputClass}
              >
                {RELEASE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label-xbox mb-2 inline-flex">Release date</span>
              <input
                type="date"
                value={mDate}
                onChange={(e) => setMDate(e.target.value)}
                disabled={pending}
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="label-xbox mb-2 inline-flex">Cover image URL</span>
              <input
                type="url"
                value={mCover}
                onChange={(e) => setMCover(e.target.value)}
                disabled={pending}
                className={inputClass}
                placeholder="https://… (Bandcamp art works — right-click, copy image address)"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="label-xbox mb-2 inline-flex">Tracklist — one per line</span>
              <textarea
                value={mTracks}
                onChange={(e) => setMTracks(e.target.value)}
                disabled={pending}
                className={`${inputClass} resize-y`}
                rows={8}
                placeholder={"Intro\nSecond Song\n…"}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="label-xbox mb-2 inline-flex">Description (optional)</span>
              <textarea
                value={mDescription}
                onChange={(e) => setMDescription(e.target.value)}
                disabled={pending}
                className={`${inputClass} resize-y`}
                rows={3}
                maxLength={2000}
                placeholder="One or two lines — shown on the release page. Leave empty rather than guess."
              />
            </label>

            <label className="flex items-center gap-2 sm:col-span-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mUnreleased}
                onChange={(e) => setMUnreleased(e.target.checked)}
                disabled={pending}
                className="w-4 h-4 accent-[#1e90ff]"
              />
              <span>Mark as UNRELEASED (leak / loosie / not officially out)</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending || !mTitle.trim() || !mArtist.trim()}
              className="btn-y2k btn-y2k-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Creating..." : "Create release"}
            </button>
            {pending && (
              <span className="text-xs opacity-60 pixel-text">
                Writing the catalog row...
              </span>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-400 border border-red-500/40 bg-red-500/10 rounded px-3 py-2">
              {error}
            </div>
          )}
        </form>
      )}

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
