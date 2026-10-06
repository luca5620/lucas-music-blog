/**
 * Profile badges — the computed ones (Luca 2026-09-02).
 *
 * Three badges every profile carries, shown under the username:
 *
 *   REVIEWS TROPHY — how many reviews you've published. Ten tiers,
 *   painted with the RATING colour scale (the same greys → reds →
 *   greens → cyan → blue → purple → glowing blue the rating badges
 *   use). The early tiers are NEAR (10, 25, 50 — Luca 2026-09-12: a
 *   new member should cross one on night one; 100 was too far away
 *   to pull anyone), then 100, 200, 350, 500, 650, 800, and 1000+ is
 *   the glowing perfect-10 blue.
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

/** The count that unlocks each tier (tier 1 at 10 … tier 10 at 1000).
    Near at the start so the first trophy colour arrives on night one. */
export const TROPHY_THRESHOLDS = [10, 25, 50, 100, 200, 350, 500, 650, 800, 1000];
export const TROPHY_MAX_TIER = TROPHY_THRESHOLDS.length;
/** Kept for older copy that quoted "one tier per 100". */
export const TROPHY_STEP = 100;

export interface TrophyTier {
  /** 0–10. 0 = under 10, 10 = 1000+. */
  tier: number;
  /** Hex from the rating scale. */
  color: string;
  /** ≥9.5-rating style purple pulse (tier 9). */
  elite: boolean;
  /** Perfect-10 style blue glow (tier 10). */
  perfect: boolean;
  /** How many more until the next tier; null at the top. */
  toNext: number | null;
  /** The count the next tier unlocks at; null at the top. */
  nextAt: number | null;
  /** 0..1 progress from this tier's threshold to the next (1 at the top). */
  progress: number;
}

/** A count that hasn't earned any colour yet: readable on near-black,
    deliberately neutral so the first real colour reads as a reward. */
export const UNEARNED_GREY = "#a1a1aa";

/** Map a count to its trophy tier + colour. */
export function trophyTier(count: number): TrophyTier {
  const safe = Math.max(0, Math.floor(count));
  let tier = 0;
  while (tier < TROPHY_MAX_TIER && safe >= TROPHY_THRESHOLDS[tier]) tier += 1;
  // Tier 0 ("hasn't hit 10 yet") is a plain, unearned grey. It used to
  // be getRatingHex(0) — but the rating scale's bottom band became
  // BROWN on 2026-09-15, and tier 1 is brown too, so a member's tenth
  // review changed nothing on screen (found in the 2026-10-05 review).
  // Now the first colour is a visible step up. From tier 1 the colour
  // climbs the rating ladder as before.
  const color = tier === 0 ? UNEARNED_GREY : getRatingHex(tier);
  const top = tier >= TROPHY_MAX_TIER;
  const nextAt = top ? null : TROPHY_THRESHOLDS[tier];
  const floor = tier === 0 ? 0 : TROPHY_THRESHOLDS[tier - 1];
  return {
    tier,
    color,
    elite: tier === 9,
    perfect: top,
    toNext: nextAt === null ? null : nextAt - safe,
    nextAt,
    progress: nextAt === null ? 1 : Math.min(1, (safe - floor) / (nextAt - floor)),
  };
}

/* ── LOGS COMPLETED ───────────────────────────────────────────
   A "log" is one calendar month on THE LOG (the profile calendar);
   it's COMPLETED when every day of that month has a published review
   on it (SQL: logs_completed() in migration 054). Luca, 2026-10-05:
   it's "very prestigious", so it wears the TROPHY (reviews moved to
   a record icon), and it must look prestigious from the very first
   one — "i wouldnt want it to have like a poop color at first".

   So this ladder does NOT start at the bottom of the rating scale.
   It starts at GOLD and only climbs into the top of the ladder:
     1 log  → gold          (a full month is already a feat)
     3      → cyan
     6      → royal blue
     12     → purple ELITE  (a year of complete months — pulses)
     24     → PERFECT blue  (two years — the glowing top)
   Same TrophyTier shape as trophyTier(), so the stats strip and the
   hover card render both with the same code. */
export const LOG_THRESHOLDS = [1, 3, 6, 12, 24];
const LOG_COLORS = ["#facc15", "#06b6d4", "#2563eb", "#c084fc", "#1e90ff"];

export function logTier(count: number): TrophyTier {
  const safe = Math.max(0, Math.floor(count));
  let tier = 0;
  while (tier < LOG_THRESHOLDS.length && safe >= LOG_THRESHOLDS[tier]) tier += 1;
  const top = tier >= LOG_THRESHOLDS.length;
  const nextAt = top ? null : LOG_THRESHOLDS[tier];
  const floor = tier === 0 ? 0 : LOG_THRESHOLDS[tier - 1];
  return {
    tier,
    color: tier === 0 ? UNEARNED_GREY : LOG_COLORS[tier - 1],
    elite: tier === 4,
    perfect: top,
    toNext: nextAt === null ? null : nextAt - safe,
    nextAt,
    progress: nextAt === null ? 1 : Math.min(1, (safe - floor) / (nextAt - floor)),
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
    // Key kept (badges already awarded point at it); the words moved
    // with the feature — debates became Aux Wars on 2026-09-13.
    key: "debate_champion",
    label: "Aux Champion",
    description: "Won a featured Aux War.",
    color: "#e3342f",
    glyph: "🎧",
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
 * event key COULD collide with one of these, so never register an
 * event badge named "reviews", "logs", "likes" or "tenure".
 */
export const COMPUTED_BADGE_KEYS = ["reviews", "likes", "logs", "tenure"] as const;
export type ComputedBadgeKey = (typeof COMPUTED_BADGE_KEYS)[number];

/** Settings-page copy for the computed badges. */
export const COMPUTED_BADGE_INFO: Record<
  ComputedBadgeKey,
  { label: string; description: string }
> = {
  reviews: {
    label: "Reviews Record",
    description: "How many reviews you've published — the colour climbs at 10, 25, 50, 100 and up.",
  },
  logs: {
    label: "Logs Trophy",
    description: "Months you've completely filled on The Log — a review on every single day. Gold from the first one.",
  },
  likes: {
    label: "Likes Trophy",
    description: "Likes received on your reviews — the colour climbs at 10, 25, 50, 100 and up.",
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
