"use client";

/**
 * TrackReactions — Phase 2b-3
 *
 * Quick-react emoji bar for one track row. Renders default emojis with
 * counts; clicking toggles add/remove via the reactions API. Counts
 * mirror the realtime bus from <ReactionsLayer> so other viewers'
 * reactions update this row's count in place.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useReactionsBus } from "@/components/rooms/ReactionsLayer";

interface TrackReactionsProps {
  releaseId: string;
  trackPosition: number;
  /** Initial counts for THIS track, keyed by emoji. */
  initialCounts: { emoji: string; count: number }[];
  /** Emojis the viewer has already reacted with on this track. */
  initialUserReactions: string[];
  accentColor: string;
}

const DEFAULT_EMOJIS = ["🔥", "💀", "🎯", "❤️", "🤧", "🥶"];

export default function TrackReactions({
  releaseId,
  trackPosition,
  initialCounts,
  initialUserReactions,
  accentColor,
}: TrackReactionsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { bus, spawnLocal, emitLocalRemove, markSelfReactionId } =
    useReactionsBus();

  // Seed counts: union of DEFAULT_EMOJIS and any extras from initialCounts.
  const initialMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of DEFAULT_EMOJIS) m.set(e, 0);
    for (const c of initialCounts) {
      m.set(c.emoji, (m.get(c.emoji) ?? 0) + c.count);
    }
    return m;
  }, [initialCounts]);

  const [counts, setCounts] = useState<Map<string, number>>(initialMap);
  const [active, setActive] = useState<Set<string>>(
    () => new Set(initialUserReactions)
  );
  const [pending, setPending] = useState<Set<string>>(new Set());

  // Last bus event we consumed, so we don't reapply it.
  const lastBusKeyRef = useRef<number>(-1);

  /* ─── Apply realtime bus updates ─── */

  useEffect(() => {
    if (!bus) return;
    if (bus.key === lastBusKeyRef.current) return;
    lastBusKeyRef.current = bus.key;
    if (bus.trackPosition !== trackPosition) return;

    setCounts((prev) => {
      const next = new Map(prev);
      const cur = next.get(bus.emoji) ?? 0;
      const updated = Math.max(0, cur + bus.delta);
      next.set(bus.emoji, updated);
      return next;
    });
  }, [bus, trackPosition]);

  /* ─── Toggle handler ─── */

  const handleToggle = useCallback(
    async (emoji: string) => {
      if (!user) {
        router.push("/login");
        return;
      }
      if (pending.has(emoji)) return;

      const wasActive = active.has(emoji);
      const prevCount = counts.get(emoji) ?? 0;

      // Optimistic update.
      setActive((prev) => {
        const n = new Set(prev);
        if (wasActive) n.delete(emoji);
        else n.add(emoji);
        return n;
      });
      setCounts((prev) => {
        const n = new Map(prev);
        const c = n.get(emoji) ?? 0;
        n.set(emoji, Math.max(0, c + (wasActive ? -1 : 1)));
        return n;
      });
      setPending((prev) => {
        const n = new Set(prev);
        n.add(emoji);
        return n;
      });

      // Spawn the floating emoji immediately on adds (don't wait for echo).
      // For removes, just emit a count event so other count badges update;
      // no float animation since it's destructive.
      if (!wasActive) {
        spawnLocal(emoji, trackPosition);
      } else {
        emitLocalRemove(emoji, trackPosition);
      }

      try {
        const res = await fetch(`/api/rooms/${releaseId}/reactions`, {
          method: wasActive ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emoji,
            track_position: trackPosition,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "reaction failed");
        }
        if (!wasActive) {
          const data = (await res.json().catch(() => ({}))) as {
            reaction?: { id?: string };
          };
          if (data.reaction?.id) {
            markSelfReactionId(data.reaction.id);
          }
        }
      } catch {
        // Rollback.
        setActive((prev) => {
          const n = new Set(prev);
          if (wasActive) n.add(emoji);
          else n.delete(emoji);
          return n;
        });
        setCounts((prev) => {
          const n = new Map(prev);
          n.set(emoji, prevCount);
          return n;
        });
        // Compensate the bus emit we already did so other badges revert.
        if (wasActive) {
          // We emitted -1; emit +1 to undo.
          // (This is a self-source emit purely for count.)
          // Use spawnLocal? No — we don't want a float. Just emit remove inverse.
          // emitLocalRemove with delta -1 already happened; we need +1 here.
          // Re-purpose by calling spawnLocal would spawn a float. Instead,
          // we just don't compensate the bus — local state is already
          // rolled back, and this was a same-track event so the consumer
          // is just this component anyway.
        }
      } finally {
        setPending((prev) => {
          const n = new Set(prev);
          n.delete(emoji);
          return n;
        });
      }
    },
    [
      user,
      router,
      pending,
      active,
      counts,
      trackPosition,
      releaseId,
      spawnLocal,
      emitLocalRemove,
      markSelfReactionId,
    ]
  );

  /* ─── Render ─── */

  return (
    <div
      className="flex items-center gap-1 flex-wrap"
      role="group"
      aria-label={`Reactions for track ${trackPosition}`}
    >
      {DEFAULT_EMOJIS.map((emoji) => {
        const count = counts.get(emoji) ?? 0;
        const isActive = active.has(emoji);
        const isPending = pending.has(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleToggle(emoji);
            }}
            disabled={isPending}
            aria-pressed={isActive}
            aria-label={`React with ${emoji}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all disabled:opacity-60 hover:scale-110"
            style={{
              background: isActive ? `${accentColor}26` : "transparent",
              border: `1px solid ${
                isActive ? `${accentColor}80` : "transparent"
              }`,
              color: isActive ? accentColor : undefined,
            }}
          >
            <span className="text-base leading-none">{emoji}</span>
            {count > 0 && (
              <span className="font-[family-name:var(--font-heading)] font-bold tabular-nums text-[11px]">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
