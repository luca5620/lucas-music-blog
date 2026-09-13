"use client";

/**
 * PlayerChip — a member of an aux battle room: avatar, name, and the
 * WINS stat Luca asked for ("aux battle wins can be counted and shown
 * as a stat when playing"): 🏆 battles won · rounds won.
 */

import UserLink from "@/components/ui/UserLink";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import type { AuxProfile, AuxWins } from "@/lib/db/aux-battles";

export function AuxAvatar({ profile, size = "md" }: { profile: AuxProfile; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "w-14 h-14 text-xl" : size === "sm" ? "w-6 h-6 text-[10px]" : "w-9 h-9 text-sm";
  const initial = (profile.display_name || profile.username || "?").charAt(0).toUpperCase();
  if (profile.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt={profile.display_name ?? profile.username}
        className={`${dim} rounded-full object-cover border border-white/10 shrink-0`}
      />
    );
  }
  return (
    <span
      className={`${dim} rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center shrink-0 font-bold text-accent-primary uppercase`}
    >
      {initial}
    </span>
  );
}

export function WinsTag({ wins, compact = false }: { wins: AuxWins; compact?: boolean }) {
  const t = useTranslations("aux.wins");
  if (wins.battles === 0 && wins.rounds === 0) return null;
  return (
    <span
      className="pixel-text text-[10px] uppercase tracking-wider text-osd-amber tabular-nums shrink-0"
      title={t("aria", { battles: wins.battles, rounds: wins.rounds })}
    >
      🏆 {wins.battles}
      {!compact && <> · {t("rounds", { n: wins.rounds })}</>}
    </span>
  );
}

export default function PlayerChip({
  profile,
  wins,
  tone,
  tag,
  dim = false,
  size = "md",
}: {
  profile: AuxProfile;
  wins?: AuxWins;
  /** a = accent (blue), b = rose — the two sides of a match. */
  tone?: "a" | "b";
  /** Small trailing label: HOST, YOU, BYE… */
  tag?: string;
  dim?: boolean;
  size?: "sm" | "md";
}) {
  const ring =
    tone === "a"
      ? "border-accent-primary/50"
      : tone === "b"
        ? "border-accent-rose/50"
        : "border-border-subtle";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border ${ring} bg-bg-elevated/70 pl-1 pr-3 py-1 max-w-full ${dim ? "opacity-50" : ""}`}
    >
      <AuxAvatar profile={profile} size={size === "sm" ? "sm" : "md"} />
      <span className="min-w-0 flex flex-col leading-tight">
        <span className="flex items-center gap-1 min-w-0">
          <UserLink
            username={profile.username}
            className="text-xs sm:text-sm font-bold text-text-primary hover:text-accent-primary transition-colors font-[family-name:var(--font-heading)] truncate max-w-[9rem]"
          >
            {profile.display_name || profile.username}
          </UserLink>
          <VerifiedBadge role={profile.role} />
          {tag && (
            <span className="pixel-text text-[9px] uppercase tracking-widest text-text-muted border border-border-medium rounded px-1">
              {tag}
            </span>
          )}
        </span>
        {wins && <WinsTag wins={wins} compact={size === "sm"} />}
      </span>
    </span>
  );
}
