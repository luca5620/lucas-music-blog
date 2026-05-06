"use client";

/**
 * SpotifyAutocomplete — Phase 2a-3
 *
 * Despite the name, this component currently searches the LOCAL releases
 * table only via /api/search/spotify. The "Spotify" prefix is forward-
 * looking: when we wire up real Spotify external search later, this
 * component will be the one place to fan out and merge results.
 *
 * Visual: panel-xbox dropdown with hover-glow rows, accent-color focus ring,
 * scan-bar at the bottom for the Y2K vibe.
 *
 * NOT used anywhere yet — will be wired into the review form in 2a-4.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface AutocompleteItem {
  id: string;
  slug: string;
  title: string;
  artist_name: string;
  release_type: string;
  release_date: string | null;
  cover_image: string | null;
}

export interface SpotifyAutocompleteProps {
  kind: "release"; // future-proof; currently only release
  onSelect: (item: AutocompleteItem) => void;
  placeholder?: string;
  initialValue?: string;
  accentColor?: string;
  notFoundCta?: ReactNode;
}

const DEBOUNCE_MS = 300;
const DEFAULT_ACCENT = "#1e90ff";

interface ApiResponse {
  results?: AutocompleteItem[];
  error?: string;
}

function yearOf(dateStr: string | null): string | null {
  if (!dateStr || dateStr.length < 4) return null;
  return dateStr.slice(0, 4);
}

export default function SpotifyAutocomplete({
  kind,
  onSelect,
  placeholder = "Search the catalog...",
  initialValue = "",
  accentColor = DEFAULT_ACCENT,
  notFoundCta,
}: SpotifyAutocompleteProps) {
  const [value, setValue] = useState<string>(initialValue);
  const [results, setResults] = useState<AutocompleteItem[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [searchedTerm, setSearchedTerm] = useState<string>("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();

  // Debounced fetch
  useEffect(() => {
    const trimmed = value.trim();

    // Cancel any in-flight request.
    if (abortRef.current) abortRef.current.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setSearchedTerm("");
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      const ac = new AbortController();
      abortRef.current = ac;
      const url = `/api/search/spotify?q=${encodeURIComponent(
        trimmed
      )}&type=${encodeURIComponent(kind)}`;

      fetch(url, { signal: ac.signal, credentials: "same-origin" })
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as ApiResponse;
          if (!res.ok) {
            setResults([]);
            return;
          }
          setResults(Array.isArray(data.results) ? data.results : []);
          setSearchedTerm(trimmed);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setResults([]);
        })
        .finally(() => {
          if (abortRef.current === ac) {
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, kind]);

  // Click-outside to close
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  const handleSelect = useCallback(
    (item: AutocompleteItem) => {
      setValue(`${item.title} by ${item.artist_name}`);
      setOpen(false);
      setActiveIndex(-1);
      onSelect(item);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
      if (!open || results.length === 0) {
        if (e.key === "ArrowDown" && results.length > 0) {
          e.preventDefault();
          setOpen(true);
          setActiveIndex(0);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < results.length) {
          e.preventDefault();
          handleSelect(results[activeIndex]);
        }
      }
    },
    [open, results, activeIndex, handleSelect]
  );

  const showDropdown = open && value.trim().length >= 2;
  const hasNoResults = useMemo(
    () =>
      !loading &&
      results.length === 0 &&
      searchedTerm.length >= 2 &&
      searchedTerm === value.trim(),
    [loading, results.length, searchedTerm, value]
  );

  const focusRingStyle = {
    boxShadow: `0 0 0 2px ${accentColor}55`,
    borderColor: accentColor,
  } as const;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
          }
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (value.trim().length >= 2) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 bg-[rgba(0,0,0,0.4)] border border-[rgba(255,255,255,0.15)] rounded-lg text-sm text-[#e8e6e3] placeholder:text-text-muted outline-none transition-shadow focus:border-[var(--accent-primary)]"
          style={
            {
              ...({ "--accent-primary": accentColor } as React.CSSProperties),
            }
          }
          onFocusCapture={(e) => {
            // accent-driven ring on focus
            Object.assign(e.currentTarget.style, focusRingStyle);
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.boxShadow = "";
            e.currentTarget.style.borderColor = "";
          }}
        />
        {loading && (
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: accentColor }}
            aria-hidden
          />
        )}
      </div>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="panel-xbox absolute left-0 right-0 mt-2 z-50 max-h-[420px] overflow-y-auto"
        >
          {results.length > 0 ? (
            <ul className="divide-y divide-[rgba(255,255,255,0.08)]">
              {results.map((item, idx) => {
                const year = yearOf(item.release_date);
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={item.id}
                    id={`${listboxId}-opt-${idx}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => {
                      // mousedown so it fires before input blur closes us
                      e.preventDefault();
                      handleSelect(item);
                    }}
                    className="hover-glow cursor-pointer px-3 py-2 flex items-center gap-3 transition-colors"
                    style={
                      isActive
                        ? {
                            backgroundColor: `${accentColor}1a`,
                            boxShadow: `inset 2px 0 0 ${accentColor}`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className="w-8 h-8 rounded bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center overflow-hidden flex-shrink-0"
                      aria-hidden
                    >
                      {item.cover_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.cover_image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-text-muted text-xs">{"//"}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[#e8e6e3] truncate font-medium">
                        {item.title}
                      </div>
                      <div className="text-xs text-text-secondary truncate">
                        {item.artist_name || "Unknown artist"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="label-xbox text-[0.55rem]">
                        {item.release_type.toUpperCase()}
                      </span>
                      {year && (
                        <span className="pixel-text text-[0.55rem] text-text-muted uppercase tracking-widest">
                          {year}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : hasNoResults ? (
            <div className="px-3 py-4 text-center text-sm text-text-muted">
              {notFoundCta ?? (
                <span className="italic">
                  No matching release in the catalog yet
                </span>
              )}
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-xs text-text-muted italic">
              Searching...
            </div>
          )}
          <div className="scan-bar" />
        </div>
      )}
    </div>
  );
}
