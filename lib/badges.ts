/**
 * Profile badges — the computed ones (Luca 2026-09-02).
 *
 * Three badges every profile carries, shown under the username:
 *
 *   REVIEWS TROPHY — how many reviews you've published. Tiered in
 *   100s and painted with the RATING colour scale (the same greys →
 *   reds → greens → cyan → blue → purple → glowing blue the rating
 *   badges use), so 100 reviews reads like a "1", 500 like a "5",
 *   and 1000+ is the glowing perfect-10 blue.
 *
 *   LIKES TROPHY — same tiers, same colours, for likes RECEIVED on
 *   your reviews.
 *
 *   YEARS OF SERVICE — Steam-style tenure. Months until the first
 *   anniversary ("7 MO"), then whole years ("1 YR", "2 YRS").
 *   Hover (web) / tap (app) reveals the exact join date.
 *
 * Event badges that can't be computed (beta crew, release-night
 * attendance, contest wins) live in `profile_badges` (migration 039)
 * and are described by EVENT_BADGES below — add an entry there, then
 * award it with `select award_badge('username', 'key')` in the SQL
 * editor, or via the founder tool at /admin/badges.
 */

import { getRatingHex } from "@/lib/rating";
import { formatDate } from "@/lib/dates";

/** Reviews / likes per tier step. 10 steps = the glowing blue. */
export const TROPHY_STEP = 100;
export const TROPHY_MAX_TIER = 10;

export interface TrophyTier {
  /** 0–10. 0 = under 100, 10 = 1000+. */
  tier: number;
  /** Hex from the rating scale. */
  color: string;
  /** ≥9.5-rating style purple pulse (tier 9). */
  elite: boolean;
  /** Perfect-10 style blue glow (tier 10). */
  perfect: boolean;
  /** How many more until the next tier; null at the top. */
  toNext: number | null;
}

/** Map a count to its trophy tier + colour. */
export function trophyTier(count: number): TrophyTier {
  const safe = Math.max(0, Math.floor(count));
  const tier = Math.min(TROPHY_MAX_TIER, Math.floor(safe / TROPHY_STEP));
  // The rating scale's bottom colour (0–1.9) is a readable light grey —
  // exactly right for "hasn't hit 100 yet"; from tier 2 up the colours
  // climb through the rating ladder.
  const color = getRatingHex(tier);
  return {
    tier,
    color,
    elite: tier === 9,
    perfect: tier >= TROPHY_MAX_TIER,
    toNext: tier >= TROPHY_MAX_TIER ? null : (tier + 1) * TROPHY_STEP - safe,
  };
}

export interface Tenure {
  /** Whole months since joining (0 for a brand-new account). */
  months: number;
  /** Whole years — only meaningful once ≥ 12 months. */
  years: number;
  /** "3 MO" / "1 YR" / "2 YRS" — the badge's face. */
  label: string;
  /** "Member since Sept 2, 2026". */
  since: string;
}

/**
 * Tenure from a created_at timestamp. Whole calendar months, so
 * someone who joined Sept 2 becomes "1 MO" on Oct 2, not after 30
 * days; and "1 YR" exactly on the anniversary.
 */
export function tenureFrom(createdAt: string, now: Date = new Date()): Tenure {
  const joined = new Date(createdAt);
  let months =
    (now.getFullYear() - joined.getFullYear()) * 12 +
    (now.getMonth() - joined.getMonth());
  if (now.getDate() < joined.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const label =
    years >= 1 ? `${years} ${years === 1 ? "YR" : "YRS"}` : `${months} MO`;
  return {
    months,
    years,
    label,
    since: `Member since ${formatDate(createdAt) ?? "day one"}`,
  };
}

/* ------------------------------------------------------------------ */
/*  Event / awarded badges                                             */
/* ------------------------------------------------------------------ */

export interface EventBadgeDef {
  key: string;
  label: string;
  /** One-line meaning, shown in the tooltip under the label. */
  description: string;
  /** Hex used for the ring + glow. */
  color: string;
  /** Single glyph drawn on the badge face (emoji or character). */
  glyph: string;
}

/**
 * The registry of badges the app knows how to draw. A row in
 * profile_badges with a key that ISN'T here renders nothing (never
 * crashes) — so it's safe to award ahead of a deploy.
 *
 * Planned, not yet awarded (Luca: "future badges should be planned as
 * well for a possibility of a future app event"): keep adding here.
 */
export const EVENT_BADGES: EventBadgeDef[] = [
  {
    key: "beta_2026",
    label: "Beta Crew",
    description: "Was here before launch — helped shape the app in 2026.",
    color: "#a855f7",
    glyph: "β",
  },
  {
    key: "release_night",
    label: "Release Night",
    description: "Was in the live room the night a record dropped.",
    color: "#f0b93c",
    glyph: "◉",
  },
  {
    key: "debate_champion",
    label: "Debate Champion",
    description: "Won a featured community debate.",
    color: "#e3342f",
    glyph: "⚔",
  },
  {
    key: "list_master",
    label: "List Master",
    description: "Built a list the community couldn't stop liking.",
    color: "#06b6d4",
    glyph: "≡",
  },
  {
    key: "android_tester",
    label: "Android Tester",
    description: "One of the first testers of the Android app.",
    color: "#84cc16",
    glyph: "▲",
  },
];

export function eventBadge(key: string): EventBadgeDef | undefined {
  return EVENT_BADGES.find((b) => b.key === key);
}

/* ------------------------------------------------------------------ */
/*  Hiding badges (migration 040)                                      */
/* ------------------------------------------------------------------ */

/**
 * The three computed badges, by the key `hidden_badges` stores them
 * under. Event badges are stored under their own `badge_key` — the
 * profile_badges check constraint (`^[a-z0-9_-]{2,40}$`) means an
 * event key COULD collide with one of these three, so never register
 * an event badge named "reviews", "likes" or "tenure".
 */
export const COMPUTED_BADGE_KEYS = ["reviews", "likes", "tenure"] as const;
export type ComputedBadgeKey = (typeof COMPUTED_BADGE_KEYS)[number];

/** Settings-page copy for the three computed badges. */
export const COMPUTED_BADGE_INFO: Record<
  ComputedBadgeKey,
  { label: string; description: string }
> = {
  reviews: {
    label: "Reviews Trophy",
    description: "How many reviews you've published, tiered per 100.",
  },
  likes: {
    label: "Likes Trophy",
    description: "Likes received on your reviews, tiered per 100.",
  },
  tenure: {
    label: "Years of Service",
    description: "How long you've been a member — months, then years.",
  },
};

/**
 * Turn the stored `hidden_badges` column into a clean Set of keys.
 * Tolerates NULL (pre-040 rows / never touched), non-arrays (a bad
 * client) and junk entries — anything that isn't a plausible badge
 * key is dropped, so a bad stored value hides nothing instead of
 * throwing on render.
 */
export function hiddenBadgeSet(raw: unknown): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(
    raw.filter(
      (k): k is string => typeof k === "string" && /^[a-z0-9_-]{2,40}$/.test(k)
    )
  );
}
