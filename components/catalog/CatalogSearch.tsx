"use client";

/**
 * CatalogSearch — the one way anything enters the platform.
 *
 * Type → unified results from the local catalog, Spotify albums,
 * and Genius songs (deep catalog incl. unreleased) → pick one →
 * the release is imported on demand and the full local row is
 * handed to `onPick`. No manual title/artist/cover fields exist
 * anywhere anymore.
 *
 * Replaces the old SpotifyAutocomplete (which only searched rows
 * an admin had pre-imported).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Release } from "@/lib/types/database";

interface CatalogResult {
  source: "local" | "spotify" | "spotify_track" | "genius";
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  year: string | null;
  kind: string;
  slug?: string;
  unreleased?: boolean;
}

export interface CatalogPick {
  release: Release;
  artist_name: string;
}

interface CatalogSearchProps {
  onPick: (pick: CatalogPick) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Optional label shown above the input. */
  label?: string;
}

const SOURCE_BADGE: Record<CatalogResult["source"], { text: string; cls: string }> = {
  local: { text: "ON PMR", cls: "text-accent-glow border-accent-primary/40" },
  spotify: { text: "SPOTIFY", cls: "text-osd-green border-osd-green/40" },
  spotify_track: { text: "SPOTIFY", cls: "text-osd-green border-osd-green/40" },
  genius: { text: "GENIUS", cls: "text-osd-amber border-osd-amber/40" },
};

export default function CatalogSearch({
  onPick,
  placeholder = "Search any album, song, or artist…",
  autoFocus = false,
  label,
}: CatalogSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    lastQueryRef.current = q;
    if (q.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/search/catalog?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("search failed");
      const data = (await res.json()) as { results: CatalogResult[] };
      // A slower response for an older query must never clobber results.
      if (lastQueryRef.current === q) {
        setResults(data.results);
        setOpen(true);
      }
    } catch {
      if (lastQueryRef.current === q) setError("Search hiccuped — try again.");
    } finally {
      if (lastQueryRef.current === q) setSearching(false);
    }
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 300);
  }

  async function handlePick(r: CatalogResult) {
    const key = `${r.source}:${r.id}`;
    setImporting(key);
    setError(null);
    try {
      const res = await fetch("/api/catalog/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: r.source, id: r.id }),
      });
      const data = (await res.json()) as { release?: Release; error?: string };
      if (!res.ok || !data.release) {
        throw new Error(data.error ?? "import failed");
      }
      setOpen(false);
      setQuery("");
      setResults([]);
      onPick({ release: data.release, artist_name: r.artist });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't load that release."
      );
    } finally {
      setImporting(null);
    }
  }

  return (
    // z-40 lifts the search box (and its results dropdown) above the
    // form sections that come after it — without a z-index here, later
    // siblings paint over the dropdown in DOM order and block clicks.
    <div ref={boxRef} className="relative z-40">
      {label && (
        <label className="block text-xs uppercase tracking-widest text-text-muted mb-1.5 font-[family-name:var(--font-heading)]">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="form-input pr-20"
          aria-label="Search the music catalog"
        />
        {searching && (
          <span className="osd-text absolute right-3 top-1/2 -translate-y-1/2 text-xs animate-pulse">
            TUNING…
          </span>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-accent-rose">{error}</p>}

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-[65vh] overflow-y-auto rounded-lg border border-border-medium bg-[#0c0c0f] shadow-[0_16px_50px_rgba(0,0,0,0.8)]">
          {results.map((r) => {
            const key = `${r.source}:${r.id}`;
            const badge = SOURCE_BADGE[r.source];
            return (
              <button
                key={key}
                type="button"
                onClick={() => handlePick(r)}
                disabled={importing !== null}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-bg-elevated transition-colors disabled:opacity-60"
              >
                {/* Cover thumb */}
                <span className="w-14 h-14 rounded overflow-hidden bg-bg-elevated shrink-0 border border-border-subtle">
                  {r.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-xl">
                      💿
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-text-primary truncate">
                    {r.title}
                  </span>
                  <span className="block text-sm text-text-secondary truncate">
                    {r.artist}
                    {r.year ? ` · ${r.year}` : ""}
                    {r.kind ? ` · ${r.kind}` : ""}
                  </span>
                </span>

                {r.unreleased && (
                  <span className="pixel-text text-[10px] text-osd-amber border border-osd-amber/40 rounded px-1 py-0.5 shrink-0">
                    UNRELEASED
                  </span>
                )}

                <span
                  className={`pixel-text text-[10px] border rounded px-1 py-0.5 shrink-0 ${badge.cls}`}
                >
                  {importing === key ? "LOADING…" : badge.text}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
