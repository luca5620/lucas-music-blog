"use client";

/**
 * likeStore — a tiny in-memory "who liked what" cache shared by every
 * like button on the page (LikeButton, PostLikeButton, and the
 * fullscreen pager's RailLike).
 *
 * THE PROBLEM IT FIXES (the "like island"): the same review can be on
 * screen twice at once — once in a feed card, once in the fullscreen
 * pager — and each button used to keep its own private useState. Like
 * it in one place and the other heart didn't move until a full page
 * reload. Server components also render like counts from data fetched
 * at request time, so two islands could even START disagreeing.
 *
 * THE SHAPE: a plain module-level Map keyed `${type}:${id}` (e.g.
 * "review:abc123") holding { liked, count }, plus a per-key listener
 * set so React components can subscribe to changes. Module-level means
 * it lives exactly as long as the loaded page — navigate away with a
 * real page load and it's gone, which is what we want: the server is
 * still the source of truth between visits, this only keeps ONE visit
 * self-consistent. Zero server changes, zero persistence.
 *
 * SEEDING RULE — "first writer wins": every button seeds the store
 * from its server-fetched props on mount, but only the FIRST seed for
 * a key sticks. Later-mounting buttons for the same key adopt the
 * existing entry instead of overwriting it — otherwise a stale server
 * prop (fetched before you tapped like elsewhere) would clobber the
 * fresher optimistic state.
 */

import { useCallback, useEffect, useState } from "react";

/** What every like button renders from. */
export interface LikeState {
  liked: boolean;
  count: number;
}

/** The content types that have like endpoints today. */
export type LikeKind = "review" | "post";

/** One canonical key shape so every button agrees on the spelling. */
export function likeKey(kind: LikeKind, id: string): string {
  return `${kind}:${id}`;
}

/* ─── The store itself ─── */

// The cache. Module-level = one shared instance per loaded page.
const store = new Map<string, LikeState>();

// Per-key subscriber sets: components register a callback here and we
// call it whenever setLike() writes that key.
const listeners = new Map<string, Set<(state: LikeState) => void>>();

/**
 * Seed a key from server props — first writer wins. Returns whatever
 * the store now holds for the key (the existing entry if someone got
 * there first, otherwise the value you just seeded).
 *
 * Server-side guard: this module is bundled into client components,
 * but their FIRST render also runs on the server (SSR). A module-level
 * Map on the server would be shared across every user's requests —
 * user A's "liked" must never leak into user B's HTML — so on the
 * server we return the initial value WITHOUT storing anything.
 */
export function seedLike(key: string, initial: LikeState): LikeState {
  if (typeof window === "undefined") return initial;
  const existing = store.get(key);
  if (existing) return existing;
  store.set(key, initial);
  return initial;
}

/** Read the current state for a key (undefined if never seeded). */
export function getLike(key: string): LikeState | undefined {
  return store.get(key);
}

/**
 * Write a key and notify every subscribed button. This is the ONLY
 * write path buttons use for optimistic flips, server confirmations,
 * and error rollbacks — routing all three through here is what keeps
 * every heart for the same content in lockstep.
 */
export function setLike(key: string, state: LikeState): void {
  // Store a fresh object so React state updates (which compare by
  // reference) always see "something changed" and re-render.
  const next = { liked: state.liked, count: state.count };
  store.set(key, next);
  const subs = listeners.get(key);
  if (subs) for (const notify of subs) notify(next);
}

/**
 * Subscribe to changes on one key. Returns the unsubscribe function
 * (shaped for useEffect: `return subscribeLike(...)` cleans up).
 */
export function subscribeLike(
  key: string,
  listener: (state: LikeState) => void
): () => void {
  let subs = listeners.get(key);
  if (!subs) {
    subs = new Set();
    listeners.set(key, subs);
  }
  subs.add(listener);
  return () => {
    subs.delete(listener);
    // Don't leak empty sets when the last button for a key unmounts.
    if (subs.size === 0) listeners.delete(key);
  };
}

/* ─── React hook ─── */

/**
 * The one hook all three like buttons share: seed → subscribe → write.
 *
 * Returns the live { liked, count } for this content plus a `write`
 * function the button calls instead of its own setState — optimistic
 * flip on tap, server truth on response, rollback on error.
 */
export function useLikeState(
  kind: LikeKind,
  id: string,
  initialLiked: boolean,
  initialCount: number
): { liked: boolean; count: number; write: (next: LikeState) => void } {
  const key = likeKey(kind, id);

  // Lazy initializer runs once per component instance: seed the store
  // (no-op if another button already did — first writer wins) and
  // start local state from whatever the store holds.
  const [state, setState] = useState<LikeState>(() =>
    seedLike(key, { liked: initialLiked, count: initialCount })
  );

  useEffect(() => {
    // Catch up first: another instance may have written between our
    // initial render and this effect running (effects run after paint).
    const current = getLike(key);
    if (current) setState(current);
    // Then stay in sync for as long as we're mounted.
    return subscribeLike(key, setState);
  }, [key]);

  // Stable identity so buttons can list it in their own deps safely.
  const write = useCallback((next: LikeState) => setLike(key, next), [key]);

  return { liked: state.liked, count: state.count, write };
}
