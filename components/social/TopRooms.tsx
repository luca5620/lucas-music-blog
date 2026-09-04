"use client";

/**
 * TopRooms — the Social page's live-room discovery rail (Luca
 * 2026-08-31): the releases with the most people in their live room
 * RIGHT NOW, so the busiest rooms are one tap away.
 *
 * Presence is a realtime concept only a connected client can see, so
 * the server hands this component recently-active candidate rooms
 * and it subscribes to each one's presence topic in OBSERVE-ONLY
 * mode — same `room:${id}:presence` topics PresencePile uses, but
 * we never call track(), so lurking on the Social page doesn't count
 * you as "in" every room at once. Counts tick live and re-sort the
 * rail as people come and go.
 *
 * Topic-sharing note (the repo's standing realtime gotcha): a
 * duplicate presence topic in one client silently no-ops. Safe here
 * because the Social page never mounts ChatPanel/PresencePile — no
 * release page is open at the same time within this tab.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ActiveRoomCandidate } from "@/lib/db/social";
import { smallCover } from "@/lib/images";

export default function TopRooms({
  rooms,
  maxShown = 6,
}: {
  rooms: ActiveRoomCandidate[];
  maxShown?: number;
}) {
  // roomId -> live head-count (users + guests, deduped by presence key).
  const t = useTranslations("topRooms");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isSupabaseConfigured() || rooms.length === 0) return;
    const supabase = createClient();

    const channels = rooms.map((room) => {
      const channel = supabase.channel(`room:${room.roomId}:presence`);
      const update = () => {
        const state = channel.presenceState();
        setCounts((prev) => ({
          ...prev,
          [room.roomId]: Object.keys(state).length,
        }));
      };
      channel
        .on("presence", { event: "sync" }, update)
        .on("presence", { event: "join" }, update)
        .on("presence", { event: "leave" }, update)
        .subscribe();
      // No track() — observe only.
      return channel;
    });

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
    // Candidate list is server-fetched once per page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms.map((r) => r.roomId).join(",")]);

  if (rooms.length === 0) return null;

  // Live ranking: most people first, recency as the tiebreak (the
  // server already ordered candidates by last activity).
  const ranked = [...rooms]
    .sort((a, b) => (counts[b.roomId] ?? 0) - (counts[a.roomId] ?? 0))
    .slice(0, maxShown);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="label-xbox">{t("title")}</h2>
        <span className="text-xs text-text-muted">
          {t("sub")}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ranked.map((room) => {
          const here = counts[room.roomId] ?? 0;
          return (
            <Link
              key={room.roomId}
              href={`/releases/${room.releaseSlug}`}
              className="card-y2k p-3 flex items-center gap-3 hover-glow"
            >
              {room.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={smallCover(room.coverImage)}
                  alt={room.title}
                  loading="lazy"
                  decoding="async"
                  className="w-12 h-12 rounded object-cover border border-white/10 shrink-0"
                />
              ) : (
                <span className="w-12 h-12 rounded bg-bg-elevated border border-white/10 flex items-center justify-center text-lg shrink-0">
                  💿
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)]">
                  {room.title}
                </span>
                <span className="block text-xs text-text-muted truncate">
                  {room.artistName}
                </span>
                {/* Live head-count — green pulse when occupied,
                    quiet OSD text when empty but recently active */}
                {here > 0 ? (
                  <span className="inline-flex items-center gap-1.5 mt-0.5 text-xs font-bold text-accent-primary tabular-nums">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
                    {t("here", { n: here })}
                  </span>
                ) : (
                  <span className="block mt-0.5 pixel-text text-[0.6rem] uppercase tracking-widest text-text-muted">
                    {t("recentlyLive")}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
