"use client";

/**
 * AuxRoom — the live client half of an aux battle page. Three looks,
 * driven by room.status:
 *
 *   LOBBY    — who's in, grab a spot / just watch / leave, the host's
 *              settings line, the private code (host only), START.
 *   LIVE     — the STAGE for the current game: picking (each player
 *              gets a SongPicker on their side, the other side shows
 *              "locked in" or "picking…"), then listening (both songs
 *              with their embeds, vote buttons for the crowd, 🔥/💩
 *              quick reactions that float up on every screen, the
 *              live tally), the host's CALL IT / pick buttons, the
 *              overtime banner, the WinnerBurst when a game closes;
 *              the bracket underneath.
 *   FINISHED — the champion card (or "ended"), the final bracket.
 *
 * One realtime channel carries everything but chat (AuxChat has its
 * own): the room row, members, matches, games (votes ride on the
 * game row through the trigger), and reactions. A full resync from
 * /api/aux-battles/[id]/state runs on reconnect and when the tab
 * comes back — belt and braces, so a missed event can't strand a
 * screen on the wrong phase.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { hapticTap, shareLink } from "@/lib/native";
import BackLink from "@/components/ui/BackLink";
import ReportButton from "@/components/moderation/ReportButton";
import type {
  AuxGame,
  AuxMatch,
  AuxMember,
  AuxReaction,
  AuxRoom as AuxRoomRow,
  AuxSong,
} from "@/lib/types/database";
import type {
  AuxMemberWithProfile,
  AuxMessageWithProfile,
  AuxProfile,
  AuxRoomState,
  AuxWins,
} from "@/lib/db/aux-battles";
import PlayerChip, { AuxAvatar, WinsTag } from "@/components/aux-battles/PlayerChip";
import SongPicker from "@/components/aux-battles/SongPicker";
import SongEmbed, { sourceTag } from "@/components/aux-battles/SongEmbed";
import Bracket from "@/components/aux-battles/Bracket";
import WinnerBurst from "@/components/aux-battles/WinnerBurst";
import AuxChat from "@/components/aux-battles/AuxChat";

interface Props {
  initial: AuxRoomState;
  initialMessages: AuxMessageWithProfile[];
  initialVote: "a" | "b" | null;
  /** The private room's code — only ever passed to the host. */
  code: string | null;
}

interface Floater {
  id: number;
  side: "a" | "b";
  kind: "fire" | "poop";
  left: number;
}

type Burst =
  | { kind: "game"; side: "a" | "b"; song: AuxSong | null; player: AuxProfile | null; key: string }
  | { kind: "overtime"; key: string }
  | { kind: "champion"; player: AuxProfile | null; key: string };

async function post(url: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? "Something broke.");
  return data;
}

export default function AuxRoom({ initial, initialMessages, initialVote, code }: Props) {
  const { user } = useAuth();
  const t = useTranslations("aux.room");
  const supabaseRef = useRef(createClient());

  const [room, setRoom] = useState<AuxRoomState["room"]>(initial.room);
  const [members, setMembers] = useState<AuxMemberWithProfile[]>(initial.members);
  const [matches, setMatches] = useState<AuxMatch[]>(initial.matches);
  const [games, setGames] = useState<AuxGame[]>(initial.games);
  const [myVote, setMyVote] = useState<"a" | "b" | null>(initialVote);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsHost, setNeedsHost] = useState<"tie" | "no_votes" | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [heat, setHeat] = useState<{ a: { fire: number; poop: number }; b: { fire: number; poop: number } }>({
    a: { fire: 0, poop: 0 },
    b: { fire: 0, poop: 0 },
  });
  const [burst, setBurst] = useState<Burst | null>(null);
  const [copied, setCopied] = useState(false);
  const floaterId = useRef(0);
  const profileCache = useRef<Map<string, AuxProfile>>(new Map(initial.members.map((m) => [m.user_id, m.profile])));
  const lastGameSeen = useRef<string | null>(initial.room.current_game_id);

  /* ─── Derived ─── */
  const isHost = !!user && user.id === room.host_id;
  const me = members.find((m) => m.user_id === user?.id) ?? null;
  const players = members.filter((m) => m.role === "player");
  const viewers = members.filter((m) => m.role === "viewer");
  const currentGame = useMemo(
    () => games.find((g) => g.id === room.current_game_id) ?? null,
    [games, room.current_game_id]
  );
  const currentMatch = useMemo(
    () => (currentGame ? matches.find((m) => m.id === currentGame.match_id) ?? null : null),
    [matches, currentGame]
  );
  const byUser = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const playerA = currentMatch ? byUser.get(currentMatch.player_a_id) ?? null : null;
  const playerB = currentMatch?.player_b_id ? byUser.get(currentMatch.player_b_id) ?? null : null;
  const mySide: "a" | "b" | null =
    currentMatch && user
      ? currentMatch.player_a_id === user.id
        ? "a"
        : currentMatch.player_b_id === user.id
          ? "b"
          : null
      : null;
  const canVote = !!user && !!currentGame && currentGame.phase === "listening" && !mySide;

  /* ─── Resync (reconnect / tab back) ─── */
  const resync = useCallback(async () => {
    try {
      const res = await fetch(`/api/aux-battles/${room.id}/state`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as AuxRoomState & { vote?: "a" | "b" | null };
      setRoom(data.room);
      setMembers(data.members);
      for (const m of data.members) profileCache.current.set(m.user_id, m.profile);
      setMatches(data.matches);
      setGames(data.games);
      if (data.vote !== undefined) setMyVote(data.vote);
    } catch {
      /* the next event will catch us up */
    }
  }, [room.id]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [resync]);

  /* ─── Profiles + wins for members who arrive live ─── */
  const hydrateMember = useCallback(async (row: AuxMember): Promise<AuxMemberWithProfile | null> => {
    let profile = profileCache.current.get(row.user_id) ?? null;
    if (!profile) {
      const { data } = await supabaseRef.current
        .from("profiles")
        .select("id, username, display_name, avatar_url, role")
        .eq("id", row.user_id)
        .maybeSingle();
      profile = (data as AuxProfile | null) ?? null;
      if (profile) profileCache.current.set(row.user_id, profile);
    }
    if (!profile) return null;
    let wins: AuxWins = { battles: 0, rounds: 0 };
    const { data: w } = await supabaseRef.current.rpc("aux_wins_for", { p_user_ids: [row.user_id] } as never);
    const first = (w as { battles: number; rounds: number }[] | null)?.[0];
    if (first) wins = { battles: first.battles, rounds: first.rounds };
    return { ...row, profile, wins };
  }, []);

  /* ─── Realtime ─── */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = supabaseRef.current;
    const id = room.id;
    const channel = supabase
      .channel(`aux:${id}`)
      .on(
        "postgres_changes" as never,
        { event: "UPDATE", schema: "public", table: "aux_rooms", filter: `id=eq.${id}` },
        async (payload: { new: AuxRoomRow }) => {
          const row = payload.new;
          if (!row?.id) return;
          let champion: AuxProfile | null = null;
          if (row.champion_id) {
            champion = profileCache.current.get(row.champion_id) ?? null;
            if (!champion) {
              const { data } = await supabase
                .from("profiles")
                .select("id, username, display_name, avatar_url, role")
                .eq("id", row.champion_id)
                .maybeSingle();
              champion = (data as AuxProfile | null) ?? null;
            }
          }
          setRoom((prev) => ({ ...prev, ...row, host: prev.host, champion }));
        }
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "aux_members", filter: `room_id=eq.${id}` },
        async (payload: { eventType: string; new: AuxMember | null; old: Partial<AuxMember> | null }) => {
          if (payload.eventType === "DELETE") {
            const uid = payload.old?.user_id;
            if (uid) setMembers((prev) => prev.filter((m) => m.user_id !== uid));
            return;
          }
          const row = payload.new;
          if (!row?.user_id) return;
          const full = await hydrateMember(row);
          if (!full) return;
          setMembers((prev) => {
            const i = prev.findIndex((m) => m.user_id === full.user_id);
            if (i === -1) return [...prev, full];
            const next = [...prev];
            next[i] = { ...next[i], ...full };
            return next;
          });
        }
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "aux_matches", filter: `room_id=eq.${id}` },
        (payload: { eventType: string; new: AuxMatch | null }) => {
          const row = payload.new;
          if (!row?.id) return;
          setMatches((prev) => {
            const i = prev.findIndex((m) => m.id === row.id);
            const next = i === -1 ? [...prev, row] : prev.map((m) => (m.id === row.id ? row : m));
            return next.sort((a, b) => a.round - b.round || a.position - b.position);
          });
        }
      )
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "aux_games", filter: `room_id=eq.${id}` },
        (payload: { eventType: string; new: AuxGame | null }) => {
          const row = payload.new;
          if (!row?.id) return;
          setGames((prev) => {
            const i = prev.findIndex((g) => g.id === row.id);
            return i === -1 ? [...prev, row] : prev.map((g) => (g.id === row.id ? row : g));
          });
        }
      )
      .on(
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "aux_reactions", filter: `room_id=eq.${id}` },
        (payload: { new: AuxReaction }) => {
          const row = payload.new;
          if (!row?.id) return;
          pushFloater(row.side, row.kind);
        }
      )
      .subscribe((status: string) => {
        // After a drop + rejoin, pull the truth once.
        if (status === "SUBSCRIBED") void resync();
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, hydrateMember, resync]);

  /* ─── Floating 🔥 / 💩 ─── */
  const pushFloater = useCallback((side: "a" | "b", kind: "fire" | "poop") => {
    const fid = ++floaterId.current;
    setFloaters((prev) => [...prev.slice(-30), { id: fid, side, kind, left: 10 + Math.random() * 80 }]);
    setHeat((h) => ({ ...h, [side]: { ...h[side], [kind]: h[side][kind] + 1 } }));
    window.setTimeout(() => setFloaters((prev) => prev.filter((f) => f.id !== fid)), 1800);
  }, []);

  /* ─── Game transitions → bursts, reset per-game state ─── */
  useEffect(() => {
    const gid = room.current_game_id;
    if (gid !== lastGameSeen.current) {
      lastGameSeen.current = gid;
      setMyVote(null);
      setNeedsHost(null);
      setHeat({ a: { fire: 0, poop: 0 }, b: { fire: 0, poop: 0 } });
      const g = games.find((x) => x.id === gid);
      if (g?.is_ot) setBurst({ kind: "overtime", key: `ot-${g.id}` });
    }
  }, [room.current_game_id, games]);

  // A game that just closed with a winner → the burst.
  const closedRef = useRef<Set<string>>(new Set(initial.games.filter((g) => g.phase === "done").map((g) => g.id)));
  useEffect(() => {
    for (const g of games) {
      if (g.phase !== "done" || closedRef.current.has(g.id)) continue;
      closedRef.current.add(g.id);
      if (!g.winner_side) continue; // an OT hand-off, not a win
      const m = matches.find((x) => x.id === g.match_id);
      const winnerId = m ? (g.winner_side === "a" ? m.player_a_id : m.player_b_id) : null;
      const player = winnerId ? profileCache.current.get(winnerId) ?? null : null;
      const song = g.winner_side === "a" ? g.song_a : g.song_b;
      setBurst({ kind: "game", side: g.winner_side, song, player, key: `g-${g.id}` });
    }
  }, [games, matches]);

  // The champion burst stays until dismissed.
  const crownedRef = useRef<string | null>(initial.room.champion_id);
  useEffect(() => {
    if (room.status === "finished" && room.champion_id && crownedRef.current !== room.champion_id) {
      crownedRef.current = room.champion_id;
      // Let the last game's burst play first.
      window.setTimeout(() => setBurst({ kind: "champion", player: room.champion, key: `c-${room.id}` }), 2400);
    }
  }, [room.status, room.champion_id, room.champion, room.id]);

  /* ─── Actions ─── */
  const act = useCallback(
    async (key: string, fn: () => Promise<unknown>) => {
      if (busy) return;
      hapticTap();
      setBusy(key);
      setError(null);
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something broke.");
      } finally {
        setBusy(null);
      }
    },
    [busy]
  );

  const join = (role: "player" | "viewer") =>
    act(`join-${role}`, () => post(`/api/aux-battles/${room.id}/members`, { role }));
  const leave = () =>
    act("leave", async () => {
      const res = await fetch(`/api/aux-battles/${room.id}/members`, { method: "DELETE" });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't leave.");
    });
  const start = () => act("start", () => post(`/api/aux-battles/${room.id}/start`));
  const end = () => {
    if (!window.confirm(t("endConfirm"))) return;
    void act("end", () => post(`/api/aux-battles/${room.id}/end`));
  };
  const vote = (side: "a" | "b") =>
    act(`vote-${side}`, async () => {
      setMyVote(side);
      await post(`/api/aux-battles/${room.id}/vote`, { side });
    });
  const react = (side: "a" | "b", kind: "fire" | "poop") => {
    hapticTap();
    pushFloater(side, kind); // instant on my screen; the echo is deduped by the 30-cap
    void fetch(`/api/aux-battles/${room.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side, kind }),
    });
  };
  const call = (side?: "a" | "b") =>
    act(`call-${side ?? "crowd"}`, async () => {
      const data = (await post(`/api/aux-battles/${room.id}/call`, side ? { side } : {})) as {
        needsHost?: "tie" | "no_votes";
      };
      setNeedsHost(data.needsHost ?? null);
    });
  const pick = async (song: AuxSong) => {
    await post(`/api/aux-battles/${room.id}/pick`, { song });
  };
  const share = () => {
    hapticTap();
    void shareLink(room.topic, `${window.location.origin}/aux-battles/${room.slug}`);
  };
  const copyCode = () => {
    if (!code) return;
    hapticTap();
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  // Duplicate my own reaction echo: the realtime INSERT for a tap I
  // already floated. The cap + short life make a doubled 🔥 harmless,
  // so no dedupe machinery — the crowd noise is supposed to be noisy.

  const statusPill =
    room.status === "live" ? (
      <span className="osd-text text-xs">
        <span className="text-[#ff4455] animate-pulse">●</span> {t("onAir")}
      </span>
    ) : room.status === "lobby" ? (
      <span className="osd-text text-xs text-osd-amber">◌ {t("lobby")}</span>
    ) : (
      <span className="osd-text text-xs opacity-70">{t("final")}</span>
    );

  const settingsLine = [
    room.format === "bo3" ? t("bo3") : t("bo1"),
    room.judge === "host" ? t("hostJudge") : t("crowdJudge"),
    room.is_private ? t("privateRoom") : t("publicRoom"),
  ].join(" · ");

  const winsFor = (uid: string | null | undefined): AuxWins | undefined =>
    uid ? byUser.get(uid)?.wins : undefined;

  /* ─── Render ─── */
  return (
    <div className="max-w-6xl mx-auto space-y-5 relative">
      {burst && (
        <WinnerBurst
          key={burst.key}
          kind={burst.kind}
          side={burst.kind === "game" ? burst.side : null}
          song={burst.kind === "game" ? burst.song : null}
          player={burst.kind === "game" || burst.kind === "champion" ? burst.player : null}
          duration={burst.kind === "champion" ? 0 : burst.kind === "overtime" ? 2200 : 3600}
          onDone={() => setBurst(null)}
        />
      )}
      {burst?.kind === "champion" && (
        <button
          type="button"
          onClick={() => setBurst(null)}
          className="fixed inset-0 z-[61] cursor-pointer"
          aria-label={t("dismiss")}
        />
      )}

      {/* ══════════ Header ══════════ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <BackLink
            fallback="/aux-battles"
            label={t("back")}
            className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
          />
          <span className="flex items-center gap-2">
            <button type="button" onClick={share} className="btn-y2k btn-y2k-outline !py-1 !px-3 !text-xs">
              {t("share")}
            </button>
            {isHost && room.status !== "finished" && (
              <button
                type="button"
                onClick={end}
                disabled={!!busy}
                className="btn-y2k btn-y2k-outline !py-1 !px-3 !text-xs text-accent-rose disabled:opacity-50"
              >
                {t("end")}
              </button>
            )}
            {!isHost && user && <ReportButton targetType="aux_room" targetId={room.id} small />}
          </span>
        </div>

        <div className="panel-xbox-glow p-4 sm:p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center gap-3 flex-wrap">
            {statusPill}
            <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">{settingsLine}</span>
          </div>
          <h1 className="crt-title text-2xl sm:text-4xl leading-tight">{room.topic}</h1>
          <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted">
            <span>{t("hostedBy")}</span>
            {room.host && <PlayerChip profile={room.host} wins={winsFor(room.host.id)} size="sm" tag={t("hostTag")} />}
          </div>

          {/* The private code — host only */}
          {isHost && room.is_private && code && (
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <span className="pixel-text text-[10px] uppercase tracking-widest text-osd-amber">{t("code")}</span>
              <span className="font-[family-name:var(--font-vt323)] text-2xl tracking-[0.35em] text-text-primary">
                {code}
              </span>
              <button type="button" onClick={copyCode} className="btn-y2k btn-y2k-outline !py-1 !px-3 !text-xs">
                {copied ? t("copied") : t("copy")}
              </button>
              <span className="text-[11px] text-text-muted">{t("codeHint")}</span>
            </div>
          )}
          <div className="scan-bar" />
        </div>
      </section>

      {error && <p className="text-sm text-accent-rose">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {/* ══════════ LOBBY ══════════ */}
          {room.status === "lobby" && (
            <section className="panel-xbox p-4 sm:p-6 space-y-4 relative overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="glow-orb" />
                <span className="label-xbox">{t("players")}</span>
                <span className="text-xs text-text-muted tabular-nums">({players.length})</span>
              </div>
              {players.length === 0 ? (
                <p className="text-sm text-text-muted">{t("noPlayers")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {players.map((m) => (
                    <PlayerChip
                      key={m.user_id}
                      profile={m.profile}
                      wins={m.wins}
                      tag={m.user_id === room.host_id ? t("hostTag") : m.user_id === user?.id ? t("youTag") : undefined}
                    />
                  ))}
                </div>
              )}
              {viewers.length > 0 && (
                <p className="text-xs text-text-muted">{t("watching", { n: viewers.length })}</p>
              )}

              <div className="divider-glow" />

              {!user ? (
                <p className="text-sm text-text-muted">
                  {t.rich("signInToPlay", {
                    a: (chunks) => (
                      <Link href="/login" className="text-accent-primary hover:underline">
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 items-center">
                  {me?.role !== "player" && !(isHost && !room.host_plays) && (
                    <button
                      type="button"
                      onClick={() => void join("player")}
                      disabled={!!busy}
                      className="btn-y2k btn-y2k-primary disabled:opacity-50"
                    >
                      {t("grabSpot")}
                    </button>
                  )}
                  {me?.role === "player" && !isHost && (
                    <button
                      type="button"
                      onClick={() => void join("viewer")}
                      disabled={!!busy}
                      className="btn-y2k btn-y2k-outline disabled:opacity-50"
                    >
                      {t("watchOnly")}
                    </button>
                  )}
                  {me && !isHost && (
                    <button
                      type="button"
                      onClick={() => void leave()}
                      disabled={!!busy}
                      className="btn-y2k btn-y2k-outline disabled:opacity-50"
                    >
                      {t("leave")}
                    </button>
                  )}
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => void start()}
                      disabled={!!busy || players.length < 2}
                      className="btn-y2k btn-y2k-primary disabled:opacity-50"
                      title={players.length < 2 ? t("startNeed") : undefined}
                    >
                      {busy === "start" ? t("starting") : t("start")}
                    </button>
                  )}
                  {isHost && players.length < 2 && (
                    <span className="text-xs text-text-muted">{t("startNeed")}</span>
                  )}
                </div>
              )}
              <div className="scan-bar" />
            </section>
          )}

          {/* ══════════ THE STAGE ══════════ */}
          {room.status === "live" && currentGame && currentMatch && (
            <section className="panel-xbox-glow p-4 sm:p-6 space-y-4 relative overflow-hidden aux-stage">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="glow-orb" />
                <span className="label-xbox">
                  {currentGame.is_ot
                    ? t("overtime")
                    : room.format === "bo3"
                      ? t("gameN", { n: currentGame.game_no, a: currentMatch.wins_a, b: currentMatch.wins_b })
                      : t("roundN", { n: currentMatch.round })}
                </span>
                <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
                  {currentGame.phase === "picking" ? t("phasePicking") : t("phaseListening")}
                </span>
              </div>

              {/* Floating reactions layer */}
              <div className="aux-floaters" aria-hidden>
                {floaters.map((f) => (
                  <span
                    key={f.id}
                    className={`aux-floater ${f.side === "a" ? "aux-floater-a" : "aux-floater-b"}`}
                    style={{ left: `${f.side === "a" ? f.left / 2 : 50 + f.left / 2}%` }}
                  >
                    {f.kind === "fire" ? "🔥" : "💩"}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(["a", "b"] as const).map((side) => {
                  const player = side === "a" ? playerA : playerB;
                  const song = side === "a" ? currentGame.song_a : currentGame.song_b;
                  const votes = side === "a" ? currentGame.votes_a : currentGame.votes_b;
                  const ring = side === "a" ? "border-accent-primary/50" : "border-accent-rose/50";
                  const color = side === "a" ? "text-accent-primary" : "text-accent-rose";
                  const listening = currentGame.phase === "listening";
                  return (
                    <div key={side} className={`rounded-lg border ${ring} bg-black/25 p-3 sm:p-4 space-y-3 min-w-0`}>
                      <div className="flex items-center justify-between gap-2">
                        {player ? (
                          <PlayerChip profile={player.profile} wins={player.wins} tone={side} tag={player.user_id === user?.id ? t("youTag") : undefined} />
                        ) : (
                          <span className="text-xs text-text-muted">…</span>
                        )}
                        {listening && (
                          <span className={`pixel-text text-sm tabular-nums ${color}`}>
                            {t("votes", { n: votes })}
                          </span>
                        )}
                      </div>

                      {/* Picking */}
                      {currentGame.phase === "picking" &&
                        (mySide === side ? (
                          song ? (
                            <p className="text-sm text-text-secondary">✓ {t("lockedInYou", { song: song.title })}</p>
                          ) : (
                            <SongPicker tone={side} onPick={pick} />
                          )
                        ) : (
                          <p className={`text-sm ${song ? "text-text-secondary" : "text-text-muted"}`}>
                            {song ? `✓ ${t("lockedIn")}` : t("picking")}
                          </p>
                        ))}

                      {/* Listening */}
                      {listening && song && (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="w-12 h-12 rounded overflow-hidden border border-border-subtle shrink-0 bg-bg-elevated flex items-center justify-center">
                              {song.artwork ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={song.artwork} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span>🎵</span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              {song.release_slug ? (
                                <Link href={`/releases/${song.release_slug}`} className="block text-sm font-bold truncate hover:text-accent-primary transition-colors">
                                  {song.title}
                                </Link>
                              ) : (
                                <span className="block text-sm font-bold truncate">{song.title}</span>
                              )}
                              {song.artist && <span className="block text-xs text-text-secondary truncate">{song.artist}</span>}
                              <span className={`inline-block mt-0.5 pixel-text text-[9px] uppercase px-1 rounded border ${sourceTag(song.source).cls}`}>
                                {sourceTag(song.source).text}
                              </span>
                            </span>
                          </div>
                          <SongEmbed song={song} title={song.title} />

                          {/* 🔥 / 💩 + vote */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => react(side, "fire")}
                              disabled={!user}
                              className="aux-react disabled:opacity-40"
                              aria-label={t("fire")}
                            >
                              🔥 <span className="tabular-nums">{heat[side].fire}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => react(side, "poop")}
                              disabled={!user}
                              className="aux-react disabled:opacity-40"
                              aria-label={t("poop")}
                            >
                              💩 <span className="tabular-nums">{heat[side].poop}</span>
                            </button>
                            {canVote && (
                              <button
                                type="button"
                                onClick={() => void vote(side)}
                                disabled={!!busy || myVote === side}
                                className={`ml-auto btn-y2k !py-1.5 !px-3 !text-xs ${
                                  myVote === side ? "btn-y2k-primary" : "btn-y2k-outline"
                                } disabled:opacity-70`}
                              >
                                {myVote === side ? t("voted") : t("vote")}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tally bar */}
              {currentGame.phase === "listening" && (
                <div className="space-y-1">
                  <div className="debate-bar" style={{ opacity: currentGame.votes_a + currentGame.votes_b === 0 ? 0.45 : 1 }}>
                    <div
                      className="side-a"
                      style={{
                        width: `${
                          currentGame.votes_a + currentGame.votes_b === 0
                            ? 50
                            : Math.round((currentGame.votes_a / (currentGame.votes_a + currentGame.votes_b)) * 100)
                        }%`,
                      }}
                    />
                    <div
                      className="side-b"
                      style={{
                        width: `${
                          currentGame.votes_a + currentGame.votes_b === 0
                            ? 50
                            : 100 - Math.round((currentGame.votes_a / (currentGame.votes_a + currentGame.votes_b)) * 100)
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-text-muted text-center">
                    {mySide
                      ? t("playersSitOut")
                      : !user
                        ? t.rich("signInToVote", {
                            a: (chunks) => (
                              <Link href="/login" className="text-accent-primary hover:underline">
                                {chunks}
                              </Link>
                            ),
                          })
                        : room.judge === "host"
                          ? t("hostDecides")
                          : t("crowdDecides")}
                  </p>
                </div>
              )}

              {/* Host controls */}
              {isHost && (
                <div className="rounded-lg border border-osd-amber/30 bg-osd-amber/5 p-3 space-y-2">
                  <span className="pixel-text text-[10px] uppercase tracking-widest text-osd-amber">{t("hostControls")}</span>
                  {currentGame.phase === "picking" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-text-muted">{t("forfeitHint")}</span>
                      <button type="button" onClick={() => void call("a")} disabled={!!busy} className="btn-y2k btn-y2k-outline !py-1 !px-3 !text-xs text-accent-primary disabled:opacity-50">
                        {t("advance", { name: playerA?.profile.display_name || playerA?.profile.username || "A" })}
                      </button>
                      <button type="button" onClick={() => void call("b")} disabled={!!busy} className="btn-y2k btn-y2k-outline !py-1 !px-3 !text-xs text-accent-rose disabled:opacity-50">
                        {t("advance", { name: playerB?.profile.display_name || playerB?.profile.username || "B" })}
                      </button>
                    </div>
                  ) : room.judge === "host" || needsHost ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {needsHost && (
                        <span className="text-xs text-text-secondary w-full">
                          {needsHost === "tie" ? t("tieTwice") : t("noVotes")}
                        </span>
                      )}
                      <button type="button" onClick={() => void call("a")} disabled={!!busy} className="btn-y2k btn-y2k-primary !py-1.5 !px-3 !text-xs disabled:opacity-50">
                        {t("wins", { name: playerA?.profile.display_name || playerA?.profile.username || "A" })}
                      </button>
                      <button type="button" onClick={() => void call("b")} disabled={!!busy} className="btn-y2k btn-y2k-primary !py-1.5 !px-3 !text-xs !border-accent-rose !text-accent-rose disabled:opacity-50">
                        {t("wins", { name: playerB?.profile.display_name || playerB?.profile.username || "B" })}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void call()} disabled={!!busy} className="btn-y2k btn-y2k-primary !py-1.5 !px-4 !text-xs disabled:opacity-50">
                        {busy === "call-crowd" ? t("calling") : t("callIt")}
                      </button>
                      <span className="text-xs text-text-muted">{t("callHint")}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="scan-bar" />
            </section>
          )}

          {/* Live but between games (shouldn't linger) */}
          {room.status === "live" && !currentGame && (
            <section className="panel-xbox p-6 text-center">
              <span className="osd-text text-sm">{t("standBy")}</span>
            </section>
          )}

          {/* ══════════ FINISHED ══════════ */}
          {room.status === "finished" && (
            <section className="panel-xbox-glow p-5 sm:p-8 text-center space-y-3 relative overflow-hidden">
              {room.champion ? (
                <>
                  <span className="osd-text text-xs text-osd-amber">{t("champion")}</span>
                  <div className="flex flex-col items-center gap-2">
                    <AuxAvatar profile={room.champion} size="lg" />
                    <span className="crt-title text-2xl sm:text-3xl">
                      {room.champion.display_name || room.champion.username}
                    </span>
                    {winsFor(room.champion.id) && <WinsTag wins={winsFor(room.champion.id)!} />}
                  </div>
                  <p className="text-sm text-text-secondary">{t("championSub", { topic: room.topic })}</p>
                </>
              ) : (
                <>
                  <span className="osd-text text-xs opacity-70">{t("ended")}</span>
                  <p className="text-sm text-text-muted">{t("endedSub")}</p>
                </>
              )}
              <div className="pt-2">
                <Link href="/aux-battles/new" className="btn-y2k btn-y2k-primary">
                  {t("hostAnother")}
                </Link>
              </div>
              <div className="scan-bar" />
            </section>
          )}

          {/* ══════════ BRACKET ══════════ */}
          {matches.length > 0 && (
            <section className="panel-xbox p-4 sm:p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="glow-orb" style={{ animationDelay: "0.5s" }} />
                <span className="label-xbox">{room.format === "bo3" && matches.length === 1 ? t("series") : t("bracket")}</span>
              </div>
              <Bracket matches={matches} members={members} format={room.format} currentMatchId={currentMatch?.id ?? null} />
              <div className="scan-bar" />
            </section>
          )}
        </div>

        {/* ══════════ CHAT ══════════ */}
        <AuxChat
          roomId={room.id}
          hostId={room.host_id}
          initialMessages={initialMessages}
          closed={room.status === "finished"}
          className="xl:sticky xl:top-20"
        />
      </div>
    </div>
  );
}
