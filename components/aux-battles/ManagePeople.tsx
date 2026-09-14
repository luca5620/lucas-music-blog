"use client";

/**
 * ManagePeople — the host's door policy (Luca 2026-09-14: "as a host
 * of a aux battle room, you should have the choice to remove people
 * from the room or block them if they keep spam-joining").
 *
 * REMOVE takes the member row: a plain "not right now", and they can
 * walk back in. BLOCK takes the row AND leaves an aux_bans row
 * behind, which shuts re-joining, chat, votes and reactions — the
 * answer to someone who keeps coming back. Both are host-only and
 * both are enforced by RLS, not by this panel.
 *
 * Folded away by default: most rooms never need it, and a list of
 * kick buttons is not what a lobby should lead with.
 */

import { useState } from "react";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { hapticTap } from "@/lib/native";
import { AuxAvatar } from "@/components/aux-battles/PlayerChip";
import type { AuxBanWithProfile, AuxMemberWithProfile } from "@/lib/db/aux-battles";

export default function ManagePeople({
  roomId,
  hostId,
  members,
  bans,
  onBansChange,
}: {
  roomId: string;
  hostId: string;
  members: AuxMemberWithProfile[];
  bans: AuxBanWithProfile[];
  onBansChange: (next: AuxBanWithProfile[]) => void;
}) {
  const t = useTranslations("aux.manage");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The host is never in their own list — they end the battle instead.
  const people = members.filter((m) => m.user_id !== hostId);

  async function act(userId: string, ban: boolean, profile: AuxMemberWithProfile["profile"]) {
    if (busy) return;
    const name = profile.display_name || profile.username;
    if (ban && !window.confirm(t("blockConfirm", { name }))) return;
    hapticTap();
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch(`/api/aux-battles/${roomId}/bans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ban }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("failed"));
      if (ban) {
        onBansChange([
          ...bans,
          { room_id: roomId, user_id: userId, created_at: new Date().toISOString(), profile },
        ]);
      }
      // The member row's removal arrives on the realtime channel.
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setBusy(null);
    }
  }

  async function unblock(userId: string) {
    if (busy) return;
    hapticTap();
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch(`/api/aux-battles/${roomId}/bans`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error(t("failed"));
      onBansChange(bans.filter((b) => b.user_id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setBusy(null);
    }
  }

  if (people.length === 0 && bans.length === 0) return null;

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
        {open ? t("close") : t("open", { n: people.length })}
      </button>

      {open && (
        <div className="rounded-lg border border-border-medium bg-black/25 p-3 space-y-3">
          {people.length > 0 && (
            <ul className="space-y-1.5">
              {people.map((m) => (
                <li key={m.user_id} className="flex items-center gap-2">
                  <AuxAvatar profile={m.profile} size="sm" />
                  <span className="min-w-0 flex-1 text-xs font-bold truncate font-[family-name:var(--font-heading)]">
                    {m.profile.display_name || m.profile.username}
                  </span>
                  <span className="pixel-text text-[9px] uppercase tracking-widest text-text-muted shrink-0">
                    {m.role === "player" ? t("player") : t("viewer")}
                  </span>
                  <button
                    type="button"
                    onClick={() => void act(m.user_id, false, m.profile)}
                    disabled={busy === m.user_id}
                    className="btn-y2k btn-y2k-outline !py-0.5 !px-2 !text-[10px] shrink-0 disabled:opacity-45"
                  >
                    {t("remove")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(m.user_id, true, m.profile)}
                    disabled={busy === m.user_id}
                    className="btn-y2k btn-y2k-outline !py-0.5 !px-2 !text-[10px] shrink-0 text-accent-rose disabled:opacity-45"
                  >
                    {t("block")}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {bans.length > 0 && (
            <div className="space-y-1.5">
              <span className="pixel-text text-[10px] uppercase tracking-widest text-accent-rose">
                {t("blocked")}
              </span>
              <ul className="space-y-1.5">
                {bans.map((b) => (
                  <li key={b.user_id} className="flex items-center gap-2">
                    <AuxAvatar profile={b.profile} size="sm" />
                    <span className="min-w-0 flex-1 text-xs truncate text-text-muted">
                      {b.profile.display_name || b.profile.username}
                    </span>
                    <button
                      type="button"
                      onClick={() => void unblock(b.user_id)}
                      disabled={busy === b.user_id}
                      className="btn-y2k btn-y2k-outline !py-0.5 !px-2 !text-[10px] shrink-0 disabled:opacity-45"
                    >
                      {t("unblock")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-text-muted">{t("hint")}</p>
          {error && <p className="text-xs text-accent-rose">{error}</p>}
        </div>
      )}
    </div>
  );
}
