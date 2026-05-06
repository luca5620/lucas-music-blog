"use client";

/**
 * ReactionsLayer — Phase 2b-3
 *
 * Page-level wrapper for track-level emoji reactions.
 *
 * Two responsibilities:
 *
 * 1. Realtime subscription on `room:${roomId}` (same channel ChatPanel uses
 *    — Supabase coalesces multiple subscribes to one channel) listening for
 *    INSERTs on `room_reactions` filtered to `target_type = track`.
 *    Re-broadcasts events to descendants via React context.
 *
 * 2. Renders an absolutely-positioned floating-emoji ticker overlay.
 *    When a reaction event lands, spawns a transient emoji that drifts
 *    upward and fades out (~2s). Spawn position is derived by querying
 *    `[data-track-position="${n}"]` in the DOM and using its bounding
 *    rect — the release page tags each track row with that attribute.
 *
 * Self-spawn: when the local user clicks a button, the TrackReactions
 * child calls `spawnLocal()` immediately so the emoji animates without
 * waiting for the Realtime echo. The Realtime handler dedupes via a
 * ref of self-spawned reaction IDs.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { RoomReaction } from "@/lib/types/database";

/* ─── Types ─── */

export interface TrackReactionEvent {
  /** Monotonic key for React reconciliation in consumers. */
  key: number;
  emoji: string;
  trackPosition: number;
  /** 'self' if this user clicked, 'remote' if it came over Realtime. */
  source: "self" | "remote";
  /** Net delta to apply to the count. +1 for adds, -1 for removes. */
  delta: 1 | -1;
}

interface ReactionsContextValue {
  /** Latest event (for TrackReactions to mirror counts). */
  bus: TrackReactionEvent | null;
  /** Called by TrackReactions on a successful local add to spawn an emoji
      AND register the (eventually-arriving) reaction ID for dedupe. */
  spawnLocal: (emoji: string, trackPosition: number) => void;
  /** Called when the user removes their reaction (no float animation,
      just decrements count via bus). */
  emitLocalRemove: (emoji: string, trackPosition: number) => void;
  /** Register a reaction ID we know we caused, so the realtime echo
      doesn't double-spawn the floating emoji. */
  markSelfReactionId: (id: string) => void;
}

const ReactionsContext = createContext<ReactionsContextValue | null>(null);

export function useReactionsBus(): ReactionsContextValue {
  const ctx = useContext(ReactionsContext);
  if (!ctx) {
    throw new Error(
      "useReactionsBus must be used inside a <ReactionsLayer> tree"
    );
  }
  return ctx;
}

/* ─── Floating emoji sprite ─── */

interface Sprite {
  id: number;
  emoji: string;
  /** Page coordinates of spawn point. */
  x: number;
  y: number;
  /** Slight horizontal drift (-12..12 px). */
  drift: number;
}

interface ReactionsLayerProps {
  roomId: string;
  accentColor: string;
  children: React.ReactNode;
}

const FLOAT_DURATION_MS = 2000;

export default function ReactionsLayer({
  roomId,
  accentColor: _accentColor,
  children,
}: ReactionsLayerProps) {
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [bus, setBus] = useState<TrackReactionEvent | null>(null);
  const spriteIdRef = useRef(0);
  const eventKeyRef = useRef(0);
  // Track reaction IDs we caused locally — when their Realtime echo lands,
  // skip spawning a duplicate emoji.
  const selfReactionIdsRef = useRef<Set<string>>(new Set());
  // Mount marker — we ignore any Realtime payloads queued before mount.
  const mountedAtRef = useRef<number>(0);

  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, []);

  /* ─── Spawn helper ─── */

  const spawnAt = useCallback((emoji: string, x: number, y: number) => {
    const id = ++spriteIdRef.current;
    const drift = (Math.random() - 0.5) * 24; // -12..12
    setSprites((prev) => [...prev, { id, emoji, x, y, drift }]);
    window.setTimeout(() => {
      setSprites((prev) => prev.filter((s) => s.id !== id));
    }, FLOAT_DURATION_MS);
  }, []);

  const spawnForTrack = useCallback(
    (emoji: string, trackPosition: number) => {
      if (typeof document === "undefined") return;
      const row = document.querySelector(
        `[data-track-position="${trackPosition}"]`
      );
      if (!row) return;
      const rect = (row as HTMLElement).getBoundingClientRect();
      // Position roughly at mid-right of the row, where the reaction bar
      // sits. Add small randomization so multiple emojis don't stack
      // perfectly on top of each other.
      const x =
        rect.left +
        rect.width * (0.6 + Math.random() * 0.3) +
        window.scrollX;
      const y = rect.top + rect.height / 2 + window.scrollY;
      spawnAt(emoji, x, y);
    },
    [spawnAt]
  );

  /* ─── Public context handlers ─── */

  const emitEvent = useCallback(
    (
      emoji: string,
      trackPosition: number,
      source: "self" | "remote",
      delta: 1 | -1
    ) => {
      const next: TrackReactionEvent = {
        key: ++eventKeyRef.current,
        emoji,
        trackPosition,
        source,
        delta,
      };
      setBus(next);
    },
    []
  );

  const spawnLocal = useCallback(
    (emoji: string, trackPosition: number) => {
      spawnForTrack(emoji, trackPosition);
      emitEvent(emoji, trackPosition, "self", 1);
    },
    [spawnForTrack, emitEvent]
  );

  const emitLocalRemove = useCallback(
    (emoji: string, trackPosition: number) => {
      emitEvent(emoji, trackPosition, "self", -1);
    },
    [emitEvent]
  );

  const markSelfReactionId = useCallback((id: string) => {
    selfReactionIdsRef.current.add(id);
    // GC after a few seconds — should be more than enough for echo.
    window.setTimeout(() => {
      selfReactionIdsRef.current.delete(id);
    }, 10_000);
  }, []);

  /* ─── Realtime subscription ─── */

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "room_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { new: RoomReaction }) => {
          const row = payload.new;
          if (!row || row.target_type !== "track") return;
          if (row.track_position == null) return;

          // Drop anything that arrived before mount finished hydrating.
          if (
            row.created_at &&
            new Date(row.created_at).getTime() < mountedAtRef.current - 1000
          ) {
            return;
          }

          // Update counts for ALL listeners (always emit count event).
          emitEvent(row.emoji, row.track_position, "remote", 1);

          // Skip floating-emoji spawn if this is our own echo.
          if (selfReactionIdsRef.current.has(row.id)) {
            selfReactionIdsRef.current.delete(row.id);
            return;
          }

          spawnForTrack(row.emoji, row.track_position);
        }
      )
      .on(
        "postgres_changes" as never,
        {
          event: "DELETE",
          schema: "public",
          table: "room_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { old: RoomReaction }) => {
          const row = payload.old;
          if (!row || row.target_type !== "track") return;
          if (row.track_position == null) return;
          // Decrement count only — no float animation on removes.
          emitEvent(row.emoji, row.track_position, "remote", -1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, emitEvent, spawnForTrack]);

  /* ─── Render ─── */

  const contextValue: ReactionsContextValue = {
    bus,
    spawnLocal,
    emitLocalRemove,
    markSelfReactionId,
  };

  return (
    <ReactionsContext.Provider value={contextValue}>
      {children}
      {/* Ticker overlay — page-coordinate positioned, ignores pointer events. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          pointerEvents: "none",
          zIndex: 60,
        }}
      >
        {sprites.map((s) => (
          <span
            key={s.id}
            style={{
              position: "absolute",
              left: `${s.x}px`,
              top: `${s.y}px`,
              fontSize: "1.75rem",
              lineHeight: 1,
              transform: "translate(-50%, 0)",
              animation: `float-up ${FLOAT_DURATION_MS}ms ease-out forwards`,
              willChange: "transform, opacity",
              filter:
                "drop-shadow(0 0 6px rgba(255,255,255,0.4)) drop-shadow(0 0 12px rgba(30,144,255,0.4))",
              ["--float-drift" as string]: `${s.drift}px`,
            } as React.CSSProperties}
          >
            {s.emoji}
          </span>
        ))}
      </div>
    </ReactionsContext.Provider>
  );
}
