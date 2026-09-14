"use client";

/**
 * InviteFriends — the host pulls people into their room (Luca
 * 2026-09-14: "there should be a way to invite someone to your aux
 * battle you are friends with (follow each other only) and it pops up
 * in the notification center to join").
 *
 * FRIEND means the follow goes both ways. The list comes from
 * aux_invitable (which enforces that server-side, as does aux_invite
 * on the way in — the browser's list is a convenience, never the
 * check). Everyone invited gets a SEAT, so an invite into a private
 * room is worth the same as the six-letter code: they can take a spot
 * without ever being told it.
 *
 * A press-to-open panel in flow, not a portal — the iOS keyboard
 * lesson: nothing here is fixed, so nothing drifts.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { hapticTap } from "@/lib/native";
import { AuxAvatar } from "@/components/aux-battles/PlayerChip";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import type { AuxInvitable } from "@/lib/db/aux-battles";

export default function InviteFriends({ roomId }: { roomId: string }) {
  const t = useTranslations("aux.invite");
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<AuxInvitable[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/aux-battles/${roomId}/invite`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { people?: AuxInvitable[] };
      setPeople(data.people ?? []);
    } catch {
      setPeople([]);
      setError(t("loadFailed"));
    }
  }, [roomId, t]);

  useEffect(() => {
    if (open && people === null) void load();
  }, [open, people, load]);

  async function invite(userId: string) {
    if (busy) return;
    hapticTap();
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch(`/api/aux-battles/${roomId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("failed"));
      setSent((s) => new Set(s).add(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          hapticTap();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        className="btn-y2k btn-y2k-outline !py-1 !px-3 !text-xs"
      >
        {open ? t("close") : t("open")}
      </button>

      {open && (
        <div className="rounded-lg border border-border-medium bg-black/25 p-3 space-y-2">
          <p className="text-[11px] text-text-muted">{t("hint")}</p>
          {people === null ? (
            <p className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
              {t("loading")}
            </p>
          ) : people.length === 0 ? (
            <p className="text-xs text-text-muted">{t("nobody")}</p>
          ) : (
            <ul className="space-y-1 max-h-64 overflow-y-auto overscroll-contain pr-1">
              {people.map(({ profile, alreadyIn }) => {
                const done = alreadyIn || sent.has(profile.id);
                return (
                  <li key={profile.id} className="flex items-center gap-2">
                    <AuxAvatar profile={profile} size="sm" />
                    <Link
                      href={`/profile/${profile.username}`}
                      className="min-w-0 flex-1 text-xs font-bold truncate hover:text-accent-primary transition-colors font-[family-name:var(--font-heading)]"
                    >
                      {profile.display_name || profile.username}
                    </Link>
                    <VerifiedBadge role={profile.role} />
                    <button
                      type="button"
                      onClick={() => void invite(profile.id)}
                      disabled={done || busy === profile.id}
                      className="btn-y2k btn-y2k-outline !py-0.5 !px-2 !text-[10px] shrink-0 disabled:opacity-45"
                    >
                      {alreadyIn
                        ? t("alreadyIn")
                        : sent.has(profile.id)
                          ? t("sent")
                          : busy === profile.id
                            ? "…"
                            : t("send")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {error && <p className="text-xs text-accent-rose">{error}</p>}
        </div>
      )}
    </div>
  );
}
