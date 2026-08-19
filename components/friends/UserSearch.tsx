"use client";

/**
 * UserSearch — find people by username or display name.
 *
 * Lives on the Friends page so adding a friend is: type their name,
 * click their card, hit Follow on their profile. Queries the public
 * profiles table directly from the browser (profiles are world-
 * readable by design, so no API route is needed) with a debounce so
 * we don't fire on every keystroke.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import type { Profile } from "@/lib/types/database";

type Result = Pick<
  Profile,
  "username" | "display_name" | "avatar_url" | "role"
>;

export default function UserSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");

  // Close the results when clicking anywhere else.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Strip anything that could confuse the LIKE pattern or the
    // .or() filter syntax — usernames are a-z 0-9 _ anyway, and
    // display names are matched loosely.
    const cleaned = value.trim().replace(/[^a-zA-Z0-9_ .-]/g, "");
    if (cleaned.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      lastQueryRef.current = cleaned;
      const supabase = createClient();
      // Escape LIKE wildcards so "_" in a username can't match anything.
      const pattern = `%${cleaned.replace(/[%_]/g, "\\$&")}%`;
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url, role")
        .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
        .limit(8);

      // Ignore stale responses from older keystrokes.
      if (lastQueryRef.current !== cleaned) return;
      setResults((data as Result[]) ?? []);
      setOpen(true);
      setSearching(false);
    }, 300);
  }

  return (
    <div ref={boxRef} className="relative z-30">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Find people by username…"
          className="form-input pr-20"
          aria-label="Search for users"
        />
        {searching && (
          <span className="osd-text absolute right-3 top-1/2 -translate-y-1/2 text-xs animate-pulse">
            TUNING…
          </span>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-96 overflow-y-auto rounded-lg border border-border-medium bg-[#0c0c0f] shadow-[0_16px_50px_rgba(0,0,0,0.8)]">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">
              Nobody by that name yet.
            </p>
          ) : (
            results.map((r) => (
              <Link
                key={r.username}
                href={`/profile/${r.username}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg-elevated transition-colors"
              >
                {/* Avatar (or initial) */}
                <span className="w-9 h-9 rounded-full overflow-hidden bg-accent-primary/20 border border-border-subtle shrink-0 flex items-center justify-center">
                  {r.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-accent-primary uppercase">
                      {r.username.charAt(0)}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-text-primary truncate">
                    {r.display_name || r.username}
                    {r.role !== "user" && <VerifiedBadge role={r.role} />}
                  </span>
                  <span className="block text-xs text-text-secondary truncate">
                    @{r.username}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
