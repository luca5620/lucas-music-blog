/**
 * The STAGED Aux War — fixture data for /aux-wars/preview, the page
 * Luca opens in the iOS simulator to screenshot a room for the App
 * Store and Instagram (2026-09-28).
 *
 * Why a fixture and not a real room: a real room needs real players
 * picking real songs, and a real crowd voting, at the exact moment
 * the screenshot is taken. This hands the REAL room UI
 * (components/aux-wars/AuxRoom.tsx and everything under it) a
 * believable mid-vote state instead, so the picture is honest about
 * what the product looks like without anybody having to stage it.
 *
 * Everything here is typed against the real shapes — AuxRoomState,
 * AuxMessageWithProfile, AuxProfile — so if a migration adds a column
 * to aux_games (say), TypeScript fails the build right here instead
 * of the preview quietly drifting away from the real thing.
 *
 * RULES for editing this file:
 *  - Every person is FICTIONAL. Never put a real user's handle in
 *    here, and never a real person's name as a handle. Null avatars
 *    are deliberate: the default initial-in-a-circle renders.
 *  - The ids are fake, fixed UUIDs (nothing in the database has
 *    them). Demo mode never sends them anywhere — see the `demo`
 *    prop in AuxRoom / AuxChat.
 *  - The songs are real Spotify tracks, checked 2026-09-28 against
 *    open.spotify.com/oembed (the embed player loads them live).
 */

import type { AuxGame, AuxMatch, AuxSong } from "@/lib/types/database";
import type {
  AuxMemberWithProfile,
  AuxMessageWithProfile,
  AuxProfile,
  AuxRoomState,
} from "@/lib/db/aux-wars";

/**
 * What turns AuxRoom (and AuxChat under it) into the staged room.
 * Passing it at all IS demo mode; leaving it off is the normal live
 * room, untouched. `viewer` is who the screen pretends is signed in —
 * a plain crowd member, not a player and not staff, so the page shows
 * exactly what a normal signed-in viewer sees (vote buttons live, no
 * moderator ✕ on every chat line) no matter who is really looking.
 */
export interface AuxDemo {
  viewer: AuxProfile;
}

/* ─── The copy Luca asked for — change these two lines to restage ─── */

/** What the host called the room (the big title in the header). */
const ROOM_NAME = "2010s pop night";
/** The round's topic — shows on the stage under TOPIC, and on every
    round-1 card of the bracket. */
const ROUND_TOPIC = "best pop song of the 2010s";

/* ─── Fake ids ───
   A fixed, obviously-fake UUID per thing, so React keys are stable
   and nothing could ever collide with a real row. */
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

const ROOM_ID = id(1);

/* ─── People (all fictional) ─── */

function person(n: number, username: string, display_name: string | null = null): AuxProfile {
  return { id: id(100 + n), username, display_name, avatar_url: null, role: "user" };
}

// The six players. KAI and NORA are the live match.
const kai = person(1, "kaidreams", "kai");
const nora = person(2, "nightshift_nora", "nora");
const theo = person(3, "tapedeck_theo", "theo"); // the host
const jules = person(4, "jules_on_aux");
const remy = person(5, "remy_rewinds", "remy");
const ines = person(6, "ines_bsides", "ines");

// The crowd who've actually joined the room (viewers).
const pip = person(7, "pip_plays_loud");
const marlo = person(8, "marlo_fm", "marlo");
const sunny = person(9, "sunroom_sunny");
const odie = person(10, "odie_on_repeat", "odie");

/** The pretend signed-in viewer. Not a member row: in a real room
    anyone can watch and vote without joining. */
const viewer = person(11, "staticbloom");

/* ─── The two songs ─── */

// Artwork: the same Spotify cover as the oEmbed thumbnail_url, but
// the 640px size (ab67616d0000b273 + the same image hash) instead of
// the 300px one (…00001e02…) — a phone screenshot at 3x would show
// the smaller one soft on the big ▶ card. Real rooms keep the 300px.
const MAGIC: AuxSong = {
  source: "spotify",
  title: "24K Magic",
  artist: "Bruno Mars",
  artwork: "https://i.scdn.co/image/ab67616d0000b273232711f7d66a1e19e89e28c5",
  url: "https://open.spotify.com/track/6b8Be6ljOzmkOmFslEb23P",
  embed_id: "6b8Be6ljOzmkOmFslEb23P",
};

// NOTE: the id first suggested for this (…Qxlt4Z) 404s on Spotify —
// the real track is …Qxlt81 (Beauty Behind the Madness).
const FACE: AuxSong = {
  source: "spotify",
  title: "Can't Feel My Face",
  artist: "The Weeknd",
  artwork: "https://i.scdn.co/image/ab67616d0000b2737fcead687e99583072cc217b",
  url: "https://open.spotify.com/track/22VdIZQfgXJea34mQxlt81",
  embed_id: "22VdIZQfgXJea34mQxlt81",
};

// The already-decided first match of the round (theo beat jules) —
// it has songs too, because a done game always does. NOTHING on the
// page renders a done game's songs (only the WinnerBurst would, and
// it doesn't fire for games that were already done on first paint),
// so these are placeholders: search links and a dummy embed id.
const DONE_A: AuxSong = {
  source: "spotify",
  title: "Dancing On My Own",
  artist: "Robyn",
  artwork: null,
  url: "https://open.spotify.com/search/dancing%20on%20my%20own",
  embed_id: "0000000000000000000000",
};
const DONE_B: AuxSong = {
  ...DONE_A,
  title: "Call Me Maybe",
  artist: "Carly Rae Jepsen",
  url: "https://open.spotify.com/search/call%20me%20maybe",
};

/**
 * Build the whole staged room. A FUNCTION, not a constant, because
 * the timestamps are relative to "now": the chat says "3m", "just
 * now"… whenever the page is opened, not whenever this file was
 * written. The page calls it once per request.
 */
export function buildAuxDemo(now: number = Date.now()): {
  state: AuxRoomState;
  messages: AuxMessageWithProfile[];
  vote: "a" | "b" | null;
  reaction: { side: "a" | "b"; kind: "fire" | "poop" } | null;
  demo: AuxDemo;
} {
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

  /* Members: six players, four watchers. `wins` feeds the 🏆 stat on
     each PlayerChip — a couple of regulars, a couple of first-timers. */
  const member = (
    p: AuxProfile,
    role: "player" | "viewer",
    battles: number,
    rounds: number,
    joined: number
  ): AuxMemberWithProfile => ({
    room_id: ROOM_ID,
    user_id: p.id,
    role,
    joined_at: ago(joined),
    profile: p,
    wins: { battles, rounds },
  });
  const members: AuxMemberWithProfile[] = [
    member(theo, "player", 3, 9, 24),
    member(kai, "player", 2, 6, 22),
    member(nora, "player", 4, 11, 21),
    member(jules, "player", 0, 1, 20),
    member(remy, "player", 1, 3, 19),
    member(ines, "player", 0, 0, 18),
    member(pip, "viewer", 0, 0, 16),
    member(marlo, "viewer", 0, 2, 14),
    member(sunny, "viewer", 0, 0, 11),
    member(odie, "viewer", 0, 0, 7),
  ];

  /* Round 1 of a six-player, best-of-1 bracket: three matches. The
     engine only ever writes one round at a time (lib/aux-wars/
     engine.ts), so there is no round 2 yet. */
  const match = (
    n: number,
    a: AuxProfile,
    b: AuxProfile,
    status: AuxMatch["status"],
    winner: AuxProfile | null
  ): AuxMatch => ({
    id: id(200 + n),
    room_id: ROOM_ID,
    round: 1,
    position: n,
    player_a_id: a.id,
    player_b_id: b.id,
    is_bye: false,
    topic: ROUND_TOPIC,
    wins_a: winner === a ? 1 : 0,
    wins_b: winner === b ? 1 : 0,
    winner_id: winner?.id ?? null,
    status,
    created_at: ago(12),
  });
  const matches: AuxMatch[] = [
    match(0, theo, jules, "done", theo),
    match(1, kai, nora, "live", null), // ← on the stage
    match(2, remy, ines, "pending", null),
  ];

  const game = (n: number, over: Partial<AuxGame>): AuxGame => ({
    id: id(300 + n),
    match_id: matches[n].id,
    room_id: ROOM_ID,
    game_no: 1,
    is_ot: false,
    topic: null, // not a topic-each-game room: the topic rides on the match
    song_a: null,
    song_b: null,
    phase: "picking",
    winner_side: null,
    decided_by: null,
    votes_a: 0,
    votes_b: 0,
    fire_a: 0,
    poop_a: 0,
    fire_b: 0,
    poop_b: 0,
    created_at: ago(12),
    closed_at: null,
    ...over,
  });
  const games: AuxGame[] = [
    game(0, {
      song_a: DONE_A,
      song_b: DONE_B,
      phase: "done",
      winner_side: "a",
      decided_by: "crowd",
      votes_a: 12,
      votes_b: 7,
      fire_a: 9,
      poop_a: 1,
      fire_b: 5,
      poop_b: 3,
      closed_at: ago(8),
    }),
    // THE SHOT: listening (= the voting phase), crowd-judged, and
    // deliberately NOT close — 14 to 9 reads as a real race.
    game(1, {
      created_at: ago(7),
      song_a: MAGIC,
      song_b: FACE,
      phase: "listening",
      votes_a: 14,
      votes_b: 9,
      fire_a: 11,
      poop_a: 2,
      fire_b: 8,
      poop_b: 3,
    }),
  ];

  /* The chat: people arguing about the two songs. Short, casual,
     lowercase, like a real room. Oldest first (that's the order
     getAuxMessages returns). */
  const said: [AuxProfile, string, number][] = [
    [theo, "round 1 topic is up. no 2020s songs, i will check", 9],
    [pip, "24k magic walking in like it owns the place", 6],
    [marlo, "can't feel my face was on the radio for an entire year, this isn't close", 5],
    [sunny, "the bass line on 24k magic tho", 5],
    [odie, "cfmf is literally mj in 2015 and nobody can tell me otherwise", 4],
    [kai, "put some respect on bruno", 3],
    [nora, "the chorus hits different at 2am, trust", 3],
    [pip, "voting magic and i'm not sorry", 2],
    [marlo, "you're all wrong but it's fine", 1],
    [theo, "couple more minutes then i'm calling it", 0],
  ];
  const messages: AuxMessageWithProfile[] = said.map(([p, content, minutes], i) => ({
    id: id(400 + i),
    room_id: ROOM_ID,
    user_id: p.id,
    content,
    created_at: ago(minutes),
    profile: p,
  }));

  const state: AuxRoomState = {
    room: {
      id: ROOM_ID,
      // A slug no real room can have: real ones always end in
      // "-<suffix>" (app/api/aux-wars/route.ts). Only Share uses it.
      slug: "preview",
      host_id: theo.id,
      name: ROOM_NAME,
      format: "bo1",
      judge: "crowd",
      is_private: false,
      is_hidden: false,
      host_plays: true,
      topic_each_game: false,
      status: "live",
      champion_id: null,
      current_game_id: games[1].id,
      player_count: 6,
      message_count: messages.length,
      created_at: ago(26),
      started_at: ago(12),
      finished_at: null,
      host: theo,
      champion: null,
    },
    members,
    matches,
    games,
  };

  return {
    state,
    messages,
    // The viewer HAS voted — for 24K Magic, with a 🔥 on it (both are
    // already counted in the 14 and the 11 above). Side A's button is
    // the filled blue "Your pick" and its 🔥 is lit, side B keeps the
    // outlined "This one": one of each state, which reads better in a
    // screenshot than two identical outlines. For the unvoted look,
    // set both of these to null. Tapping either side still works
    // (locally) — the counts move like the real trigger would.
    vote: "a",
    reaction: { side: "a", kind: "fire" },
    demo: { viewer },
  };
}
