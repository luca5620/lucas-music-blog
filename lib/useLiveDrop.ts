"use client";

/**
 * useLiveDrop — keeps a release's drop facts (migration 064) fresh
 * while the page is open.
 *
 * THE BUG IT FIXES (ROADMAP "known limit", fixed 2026-10-27): a page
 * only knew what the drop-check said when it LOADED. Open a release
 * page at 11pm, leave it open, and at midnight the clock flipped to
 * OUT NOW even if Spotify hadn't switched the record on yet — and a
 * page opened at 2am that said "Out later today" kept saying it
 * forever, even after the record came out at 2:30. Only a refresh
 * fixed either one.
 *
 * What it does now:
 *   1. Sleeps until the drop moment (exact time or midnight Eastern —
 *      lib/upcoming dropMomentMs, never its own date math).
 *   2. At zero, asks Supabase for the two drop columns again (a tiny
 *      read with the public anon key, no Vercel server involved).
 *   3. Still "later today"? Asks again every minute (the checker
 *      itself only runs every 5 minutes, so that's plenty). If the
 *      checker found an exact time in the meantime, it sleeps until
 *      that instead.
 *   4. Really out → stops, and if `refreshOnDrop` is set, refreshes
 *      the page's server parts once (router.refresh — the banner goes,
 *      "Drops" becomes "Released", rating opens up) without a reload.
 *
 * Only runs for a release that was still upcoming when the page
 * loaded — an "OUT NOW" card on the shelf never polls anything.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dropMomentMs, isUpcoming, type DropInfo } from "@/lib/upcoming";

/** How often to re-ask while it's past the moment but not out yet. */
const RECHECK_MS = 60_000;
/** Small pad after zero so the clock shows 00:00:00 before we ask. */
const AFTER_ZERO_MS = 2_000;
/** Longest single sleep — browsers misbehave with very long timers,
    so a page left open for days just wakes up hourly and re-plans. */
const MAX_SLEEP_MS = 3_600_000;

export function useLiveDrop(
  releaseId: string | null | undefined,
  releaseDate: string,
  drop: DropInfo | null | undefined,
  { refreshOnDrop = false }: { refreshOnDrop?: boolean } = {}
): DropInfo | null | undefined {
  const router = useRouter();
  // Facts fetched after load. null = still using what the page had.
  const [fresh, setFresh] = useState<DropInfo | null>(null);
  const current = fresh ?? drop;

  // The timer loop reads the latest facts through a ref, so the effect
  // below doesn't restart every time a fetch lands.
  const latest = useRef(current);
  useEffect(() => {
    latest.current = current;
  });

  // Plain strings for the deps (a fresh drop object every render
  // would restart the loop each time).
  const dropsAt = drop?.drops_at ?? null;
  const waitingAt = drop?.drop_waiting_at ?? null;

  useEffect(() => {
    if (!releaseId) return;
    // Already out when the page loaded → nothing to watch.
    if (!isUpcoming(releaseDate, { drops_at: dropsAt, drop_waiting_at: waitingAt })) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const supabase = createClient();

    const sleep = (ms: number) => {
      if (stopped) return;
      timer = setTimeout(tick, Math.max(1_000, Math.min(ms, MAX_SLEEP_MS)));
    };

    async function tick() {
      if (stopped) return;
      const moment = dropMomentMs(releaseDate, latest.current);
      // Not zero yet → sleep until it is.
      if (Number.isNaN(moment)) return;
      if (Date.now() < moment) {
        sleep(moment - Date.now() + AFTER_ZERO_MS);
        return;
      }

      // Zero (or past it): what does the checker say NOW?
      const { data, error } = await supabase
        .from("releases")
        .select("drops_at, drop_waiting_at")
        .eq("id", releaseId!)
        .maybeSingle();
      if (stopped) return;
      if (error || !data) {
        sleep(RECHECK_MS); // network blip — try again in a minute
        return;
      }
      // The generated Database types predate migration 064, so the
      // row comes back typed as never — it IS just the two columns.
      const row = data as DropInfo;
      const facts: DropInfo = {
        drops_at: row.drops_at ?? null,
        drop_waiting_at: row.drop_waiting_at ?? null,
      };
      latest.current = facts;
      setFresh(facts);

      if (isUpcoming(releaseDate, facts)) {
        // Still not out. A new exact time → sleep until it; otherwise
        // ask again in a minute.
        const next = dropMomentMs(releaseDate, facts);
        sleep(next > Date.now() ? next - Date.now() + AFTER_ZERO_MS : RECHECK_MS);
        return;
      }

      // Really out. Let the server parts of the page catch up once.
      if (refreshOnDrop) router.refresh();
    }

    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [releaseId, releaseDate, dropsAt, waitingAt, refreshOnDrop, router]);

  return current;
}
