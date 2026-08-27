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
import { getRatingHex, formatRating } from "@/lib/rating";

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
  /** Release date is in the future — a countdown/pre-save album. */
  upcoming?: boolean;
  /** Community average for releases already on PMR — shown labeled
      so the number can't be mistaken for one person's score. */
  avg_rating?: number | null;
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
  // Spotify stays brand-green (Luca 2026-08-25) — the sitewide
  // green→blue recolor deliberately skips this one badge.
  spotify: { text: "SPOTIFY", cls: "text-osd-green border-osd-green/40" },
  spotify_track: { text: "SPOTIFY", cls: "text-osd-green border-osd-green/40" },
  genius: { text: "GENIUS", cls: "text-osd-amber border-osd-amber/40" },
};

export default function CatalogSearch({
  onPick,
  // The Spotify-link mention is load-bearing: pasting an album link is
  // the ONLY way to add an UPCOMING album (search hides those until
  // release day), so the input itself has to teach the trick.
  placeholder = "Search anything — or paste a Spotify link…",
  autoFocus = false,
  label,
}: CatalogSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Server-sent hint (e.g. "that's a countdown link, paste the album
  // link instead") — informational, styled softer than an error.
  const [notice, setNotice] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");

  // The results list renders IN FLOW, right under the input — no
  // portal, no coordinate math. History (it matters): v1 was an
  // absolutely-positioned overlay (clipped by panel overflow), v2 a
  // position:fixed portal measured off getBoundingClientRect — which
  // iOS broke whenever the keyboard was up: WKWebView pans the page
  // natively (no DOM event fires, no rect changes), so the list drew
  // over the input itself until the keyboard closed (Luca
  // 2026-08-26: "it covers the entire search box"). In-flow content
  // is how /search already renders results, and it CANNOT misplace:
  // it pans with the page like everything else. The form below just
  // shifts down while the list is open (the keyboard covers it
  // anyway on phones), and auto-height panels grow to fit.

  // Close on outside click/tap.
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
      setNotice(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/search/catalog?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("search failed");
      const data = (await res.json()) as {
        results: CatalogResult[];
        notice?: string;
      };
      // A slower response for an older query must never clobber results.
      if (lastQueryRef.current === q) {
        setResults(data.results);
        setNotice(data.notice ?? null);
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
    <div ref={boxRef}>
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
      {!error && notice && (
        <p className="mt-1.5 text-xs text-osd-amber">{notice}</p>
      )}

      {/* In-flow results — see the comment up top for why this is NOT
          an overlay. max-h keeps long lists scrolling internally. */}
      {open && results.length > 0 && (
        <div
          className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-border-medium bg-[#0c0c0f] shadow-[0_16px_50px_rgba(0,0,0,0.8)]"
        >
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

                {/* Releases already on PMR with ratings show the
                    community average, labeled as exactly that (Luca
                    2026-08-26: never let a bare number read like one
                    person's score). */}
                {typeof r.avg_rating === "number" && (
                  <span className="text-right shrink-0">
                    <span
                      className="block pixel-text text-sm font-bold tabular-nums"
                      style={{ color: getRatingHex(r.avg_rating) }}
                    >
                      {formatRating(r.avg_rating)}
                    </span>
                    <span className="block pixel-text text-[8px] uppercase tracking-widest text-text-muted">
                      community avg
                    </span>
                  </span>
                )}

                {r.unreleased && (
                  <span className="pixel-text text-[10px] text-osd-amber border border-osd-amber/40 rounded px-1 py-0.5 shrink-0">
                    UNRELEASED
                  </span>
                )}

                {/* Future release_date — the countdown-album case. */}
                {r.upcoming && (
                  <span className="pixel-text text-[10px] text-osd-amber border border-osd-amber/40 rounded px-1 py-0.5 shrink-0 animate-pulse">
                    DROPS SOON
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
