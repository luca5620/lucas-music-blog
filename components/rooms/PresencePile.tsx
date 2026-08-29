"use client";

/**
 * PresencePile — Phase 2b-4
 *
 * Avatar stack of who's currently in the live room.
 *
 * Subscribes on its own `room:${roomId}:presence` channel. It MUST NOT share
 * a topic with ChatPanel: supabase-js returns the same channel instance for a
 * duplicate topic, `subscribe()` on an already-joining channel is a silent
 * no-op, and the join only carries whichever bindings existed at first
 * subscribe — sharing the topic is exactly what silently killed all realtime
 * on release pages (plus this component's cleanup would removeChannel() the
 * shared instance whenever auth state resolved). Separate topics still
 * multiplex over the one websocket, so this costs nothing extra.
 *
 * Logged-in users track with their user_id as the presence key. Anonymous
 * visitors get a stable session-scoped UUID (regenerated per tab/refresh,
 * so a hard reload looks like a different "guest" — acceptable for now).
 *
 * Display rule: logged-in users render as discrete avatars (deduped by
 * user_id even if the same user has multiple tabs open). All anons collapse
 * into a single tail "+ N guests" chip — we don't have avatars for them,
 * and listing them individually would clutter.
 */

import { useEffect, useRef, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PresencePileProps {
  roomId: string;
  accentColor: string;
  maxVisible?: number;
  /** Reports the live head-count (users + guests) upward whenever it
      changes. The collapsed live-room bar shows this number — it
      can't subscribe itself, since a duplicate presence topic would
      silently no-op (see the header comment). */
  onCountChange?: (count: number) => void;
}

interface UserPresenceMeta {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  anon?: false;
}

interface AnonPresenceMeta {
  anon: true;
  label: string;
  user_id?: undefined;
  username?: undefined;
  display_name?: undefined;
  avatar_url?: undefined;
}

type PresenceMeta = UserPresenceMeta | AnonPresenceMeta;

interface UserEntry {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface PresenceSnapshot {
  users: UserEntry[];
  anonCount: number;
}

function snapshotFromState(
  state: Record<string, PresenceMeta[]>
): PresenceSnapshot {
  const seenUserIds = new Set<string>();
  const users: UserEntry[] = [];
  let anonCount = 0;

  for (const key of Object.keys(state)) {
    const metas = state[key];
    if (!metas || metas.length === 0) continue;
    // Take the first meta for each presence key — multiple metas for the
    // same key indicate multiple tabs from the same identity.
    const m = metas[0];
    if (m.anon === true) {
      anonCount += 1;
      continue;
    }
    if (!m.user_id || seenUserIds.has(m.user_id)) continue;
    seenUserIds.add(m.user_id);
    users.push({
      user_id: m.user_id,
      username: m.username ?? null,
      display_name: m.display_name ?? null,
      avatar_url: m.avatar_url ?? null,
    });
  }

  return { users, anonCount };
}

export default function PresencePile({
  roomId,
  accentColor,
  maxVisible = 5,
  onCountChange,
}: PresencePileProps) {
  const { user, profile } = useAuth();
  const supabaseRef = useRef(createClient());
  // Stable per-mount anon ID for unauthenticated visitors. We use a ref so
  // it survives renders but is regenerated when the component remounts.
  const anonIdRef = useRef<string | null>(null);
  const [snapshot, setSnapshot] = useState<PresenceSnapshot>({
    users: [],
    anonCount: 0,
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = supabaseRef.current;

    // Choose presence key: user.id when signed in, else a session-scoped
    // UUID so multiple tabs from the same anon visitor each count once.
    let presenceKey: string;
    if (user) {
      presenceKey = user.id;
    } else {
      if (!anonIdRef.current) {
        // crypto.randomUUID is available in all modern browsers.
        anonIdRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `anon-${Math.random().toString(36).slice(2)}-${Date.now()}`;
      }
      presenceKey = anonIdRef.current;
    }

    const channel: RealtimeChannel = supabase.channel(`room:${roomId}:presence`, {
      config: { presence: { key: presenceKey } },
    });

    const updateState = () => {
      const state = channel.presenceState() as Record<string, PresenceMeta[]>;
      setSnapshot(snapshotFromState(state));
    };

    channel
      .on("presence", { event: "sync" }, updateState)
      .on("presence", { event: "join" }, updateState)
      .on("presence", { event: "leave" }, updateState)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        if (user) {
          const meta: UserPresenceMeta = {
            user_id: user.id,
            username:
              profile?.username ??
              (user.user_metadata?.username as string | undefined) ??
              user.email?.split("@")[0] ??
              null,
            display_name:
              profile?.display_name ??
              (user.user_metadata?.display_name as string | undefined) ??
              null,
            avatar_url:
              profile?.avatar_url ??
              (user.user_metadata?.avatar_url as string | undefined) ??
              null,
          };
          await channel.track(meta);
        } else {
          const meta: AnonPresenceMeta = { anon: true, label: "guest" };
          await channel.track(meta);
        }
      });

    return () => {
      // untrack first so the leave event propagates cleanly to other clients
      // before we tear the channel down.
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
    // We intentionally only re-run when roomId / user identity changes.
    // Profile fields are read at subscribe time; updates within a session
    // won't re-broadcast, but that's fine for the heat-of-the-moment use
    // case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  const totalCount = snapshot.users.length + snapshot.anonCount;

  // Report the head-count upward (must sit above the early return —
  // hooks can't be conditional, and 0 is a real value to report).
  useEffect(() => {
    onCountChange?.(totalCount);
  }, [totalCount, onCountChange]);

  if (totalCount === 0) return null;

  const visible = snapshot.users.slice(0, maxVisible);
  const userOverflow = Math.max(0, snapshot.users.length - visible.length);
  // Total tail count = users beyond maxVisible + all anons.
  const tailCount = userOverflow + snapshot.anonCount;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {visible.map((u) => (
          <UserAvatar key={u.user_id} user={u} accentColor={accentColor} />
        ))}
        {tailCount > 0 && (
          <div
            className="w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold tabular-nums shrink-0"
            style={{
              background: `${accentColor}20`,
              borderColor: `${accentColor}55`,
              color: accentColor,
            }}
            title={
              snapshot.anonCount > 0
                ? `${userOverflow > 0 ? `${userOverflow} more, ` : ""}${snapshot.anonCount} guest${snapshot.anonCount === 1 ? "" : "s"}`
                : `${userOverflow} more`
            }
          >
            +{tailCount}
          </div>
        )}
      </div>
      <span
        className="pixel-text text-xs uppercase tracking-widest tabular-nums"
        style={{ color: accentColor }}
      >
        {totalCount} here
      </span>
    </div>
  );
}

function UserAvatar({
  user,
  accentColor,
}: {
  user: UserEntry;
  accentColor: string;
}) {
  const name = user.display_name || user.username || "user";
  const initial = name.charAt(0).toUpperCase();

  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt={name}
        title={name}
        className="w-6 h-6 rounded-full object-cover border-2 shrink-0"
        style={{ borderColor: accentColor }}
      />
    );
  }
  return (
    <div
      title={name}
      className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0"
      style={{
        background: `${accentColor}20`,
        borderColor: accentColor,
        color: accentColor,
      }}
    >
      {initial}
    </div>
  );
}
