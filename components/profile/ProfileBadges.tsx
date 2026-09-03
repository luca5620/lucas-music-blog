"use client";

/**
 * Profile badges row — sits under the username on every profile
 * (Luca 2026-09-02, replacing the "Credentials" showcase block).
 *
 *   🏆 REVIEWS trophy  — tiered by 100s, painted on the rating scale
 *   ♥  LIKES trophy    — same tiers, for likes received on reviews
 *   ⛨  YEARS OF SERVICE — months until year one, then years (Steam)
 *   +  any awarded event badges (profile_badges, migration 039)
 *
 * Every badge has a detail card: HOVER on web, TAP in the app (touch
 * has no hover). One card open at a time; outside tap / Escape closes
 * it. The card is positioned under the badge with plain CSS — no
 * portal — because the header has no overflow clipping and the row
 * is near the top of the page, so it always has room below.
 *
 * Colours: the trophies use the rating hex ladder (lib/badges.ts)
 * so "500 reviews" glows the same green a 5.0 rating does; tier 9 is
 * the purple ELITE pulse, tier 10 the blue PERFECT glow — the exact
 * treatment the rating badges wear at 9.5 and 10.
 */

import { useEffect, useRef, useState } from "react";
import {
  eventBadge,
  hiddenBadgeSet,
  tenureFrom,
  trophyTier,
  TROPHY_STEP,
} from "@/lib/badges";

interface AwardedBadge {
  badge_key: string;
  note: string | null;
  awarded_at: string;
}

interface Props {
  reviewCount: number;
  likesReceived: number;
  createdAt: string;
  awarded?: AwardedBadge[];
  /** The profile theme's accent — tints the tenure badge. */
  accentColor: string;
  /**
   * Badge keys the member chose to hide (profiles.hidden_badges,
   * migration 040). Visitors never see them; the OWNER sees them
   * dimmed with a "hidden from visitors" note so they know what's
   * tucked away — the same treatment hidden links get.
   */
  hidden?: string[] | null;
  /** Is the viewer looking at their own profile? */
  isOwner?: boolean;
}

/* One badge's face + its detail card. */
interface BadgeSpec {
  id: string;
  /** The key `hidden_badges` would store to hide this badge. */
  hideKey: string;
  /** What's drawn on the badge. */
  face: React.ReactNode;
  /** Small text next to the face (count / "3 MO"). */
  caption: string;
  color: string;
  glow: "none" | "soft" | "elite" | "perfect";
  /** Detail card copy. */
  title: string;
  lines: string[];
}

export default function ProfileBadges({
  reviewCount,
  likesReceived,
  createdAt,
  awarded = [],
  accentColor,
  hidden = null,
  isOwner = false,
}: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Which kind of pointer last touched a badge. A MOUSE hover already
  // opened the card, so its click must keep it open (otherwise the
  // click toggled it shut the instant you pressed). A TOUCH has no
  // hover, so its tap toggles.
  const lastPointer = useRef<string>("mouse");

  // Tap anywhere else (or Escape) closes the open card — the app has
  // no hover, so this is the only way a tapped card goes away.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const reviews = trophyTier(reviewCount);
  const likes = trophyTier(likesReceived);
  const tenure = tenureFrom(createdAt);

  const glowFor = (t: ReturnType<typeof trophyTier>) =>
    t.perfect ? "perfect" : t.elite ? "elite" : t.tier >= 1 ? "soft" : "none";

  const nextLine = (t: ReturnType<typeof trophyTier>, noun: string) =>
    t.toNext === null
      ? "Top tier — the glowing blue."
      : `${t.toNext} more ${noun} to the next tier (${(t.tier + 1) * TROPHY_STEP}).`;

  const badges: BadgeSpec[] = [
    {
      id: "reviews",
      hideKey: "reviews",
      face: <TrophyGlyph />,
      caption: String(reviewCount),
      color: reviews.color,
      glow: glowFor(reviews),
      title: `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`,
      lines: [
        `Reviews trophy — tier ${reviews.tier} of 10, one tier per ${TROPHY_STEP}.`,
        nextLine(reviews, "reviews"),
      ],
    },
    {
      id: "likes",
      hideKey: "likes",
      face: <HeartGlyph />,
      caption: String(likesReceived),
      color: likes.color,
      glow: glowFor(likes),
      title: `${likesReceived} ${likesReceived === 1 ? "like" : "likes"} received`,
      lines: [
        `Likes trophy — tier ${likes.tier} of 10, one tier per ${TROPHY_STEP} likes on your reviews.`,
        nextLine(likes, "likes"),
      ],
    },
    {
      id: "tenure",
      hideKey: "tenure",
      face: <ShieldGlyph />,
      caption: tenure.label,
      color: accentColor,
      glow: tenure.years >= 1 ? "soft" : "none",
      title: tenure.years >= 1
        ? `${tenure.years} ${tenure.years === 1 ? "year" : "years"} of service`
        : `${tenure.months} ${tenure.months === 1 ? "month" : "months"} of service`,
      lines: [
        tenure.since,
        tenure.years >= 1
          ? "Counts whole years from your join date."
          : "Counts whole months until your first anniversary, then years.",
      ],
    },
    // Awarded event badges — only the keys this build knows how to
    // draw; anything else is skipped silently (awarded ahead of a
    // deploy, or a key that was retired).
    ...awarded.flatMap((a): BadgeSpec[] => {
      const def = eventBadge(a.badge_key);
      if (!def) return [];
      return [
        {
          id: `event:${a.badge_key}`,
          hideKey: a.badge_key,
          face: (
            <span className="text-[15px] font-black leading-none" aria-hidden>
              {def.glyph}
            </span>
          ),
          caption: def.label,
          color: def.color,
          glow: "soft",
          title: def.label,
          lines: [def.description, ...(a.note ? [a.note] : [])],
        },
      ];
    }),
  ];

  // Hidden badges (migration 040): visitors don't get them at all;
  // the owner sees them dimmed so they know what's tucked away. If
  // everything is hidden and it's not the owner, the row vanishes
  // entirely so the header doesn't carry an empty gap.
  const hiddenSet = hiddenBadgeSet(hidden);
  const shown = badges.filter((b) => isOwner || !hiddenSet.has(b.hideKey));
  if (shown.length === 0) return null;

  return (
    <div ref={rootRef} className="flex flex-wrap items-center gap-2 pt-0.5">
      {shown.map((b) => {
        const isOpen = open === b.id;
        const isHidden = hiddenSet.has(b.hideKey);
        return (
          <div key={b.id} className={`relative${isHidden ? " opacity-40" : ""}`}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-label={isHidden ? `${b.title} (hidden from visitors)` : b.title}
              onPointerDown={(e) => {
                lastPointer.current = e.pointerType;
              }}
              onClick={() =>
                setOpen(lastPointer.current === "touch" && isOpen ? null : b.id)
              }
              onMouseEnter={() => setOpen(b.id)}
              onMouseLeave={() => setOpen((cur) => (cur === b.id ? null : cur))}
              className={`profile-badge glow-${b.glow}`}
              style={
                {
                  "--badge-color": b.color,
                  color: b.color,
                  borderColor: b.color,
                } as React.CSSProperties
              }
            >
              <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                {b.face}
              </span>
              <span className="pixel-text text-[13px] leading-none tracking-wider tabular-nums">
                {b.caption}
              </span>
            </button>

            {isOpen && (
              <div
                role="tooltip"
                className="absolute left-0 top-full mt-2 z-30 w-56 rounded-lg border p-3 space-y-1 shadow-xl"
                style={{
                  background: "rgba(8, 10, 14, 0.96)",
                  borderColor: `${b.color}55`,
                  boxShadow: `0 0 18px ${b.color}33, 0 12px 30px rgba(0,0,0,0.6)`,
                }}
              >
                <p
                  className="font-[family-name:var(--font-heading)] text-sm font-bold leading-tight"
                  style={{ color: b.color }}
                >
                  {b.title}
                </p>
                {b.lines.map((line) => (
                  <p key={line} className="text-xs text-text-secondary leading-snug">
                    {line}
                  </p>
                ))}
                {isHidden && (
                  <p className="pixel-text text-[11px] uppercase tracking-wider text-text-muted pt-1">
                    Hidden from visitors — only you see this
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---- Glyphs (16px, currentColor) ---- */

function TrophyGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]" aria-hidden>
      <path d="M6 2h12v2h3v3c0 2.8-2.1 5.1-4.8 5.4A6 6 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1a6 6 0 0 1-3.2-3.5C5.1 12.1 3 9.8 3 7V4h3V2zm0 4H5v1c0 1.5.9 2.8 2.2 3.3A6 6 0 0 1 6 7V6zm12 0v1c0 1.2-.4 2.3-1.2 3.3C18.1 9.8 19 8.5 19 7V6h-1z" />
    </svg>
  );
}

function HeartGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]" aria-hidden>
      <path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.6 5 6.2 5c2 0 3.4 1.1 4.3 2.4h3C14.4 6.1 15.8 5 17.8 5c3.6 0 5.3 3.6 3.8 6.9C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-[18px] h-[18px]" aria-hidden>
      <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6l8-3z" strokeLinejoin="round" />
      <path d="M8.5 12l2.3 2.3L15.5 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
