import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  auxRoomExists,
  getAuxBans,
  getAuxMessages,
  getAuxRoomBySlug,
  getAuxRoomState,
  getViewerAuxReaction,
  getViewerAuxVote,
  hasAuxSeat,
} from "@/lib/db/aux-wars";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSafeSlug } from "@/lib/validate";
import AuxRoom from "@/components/aux-wars/AuxRoom";
import CodeGate from "@/components/aux-wars/CodeGate";
import BackToHome from "@/components/ui/BackToHome";

// Rooms move second to second — never cache.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const room = isSafeSlug(slug) ? await getAuxRoomBySlug(slug) : null;
  if (!room) return { title: "Aux War" };
  return {
    title: `${room.name} — Aux War`,
    description: "Two songs go head to head, the room listens, the room votes.",
  };
}

/**
 * /aux-wars/[slug] — one room. The server loads the bundle (room,
 * members, matches, games), the chat backlog and the viewer's vote,
 * then hands off to AuxRoom for the live parts.
 *
 * Private rooms: RLS returns nothing until the viewer has entered the
 * code, so a null read on a slug that DOES exist (aux_slug_exists)
 * renders the CodeGate instead of a 404.
 */
export default async function AuxBattlePage({ params }: PageProps) {
  const { slug } = await params;
  if (!isSafeSlug(slug)) notFound();

  const room = await getAuxRoomBySlug(slug);
  if (!room) {
    if (await auxRoomExists(slug)) {
      return (
        <div className="space-y-6">
          <BackToHome />
          <CodeGate slug={slug} />
        </div>
      );
    }
    notFound();
  }

  const user = await getUser();
  const [state, messages, vote, reaction] = await Promise.all([
    getAuxRoomState(room),
    getAuxMessages(room.id),
    user && room.current_game_id ? getViewerAuxVote(room.current_game_id, user.id) : Promise.resolve(null),
    user && room.current_game_id
      ? getViewerAuxReaction(room.current_game_id, user.id)
      : Promise.resolve(null),
  ]);

  const isHost = !!user && room.host_id === user.id;

  // The host of a private room gets the code on first paint.
  let code: string | null = null;
  if (isHost && room.is_private) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("aux_room_code", { p_room_id: room.id } as never);
    code = typeof data === "string" ? data : null;
  }

  // A SEAT is the right to take a spot in the bracket (migration
  // 045). Public rooms hand one to everybody; a private room's comes
  // from the code or the host's invite. The block list is the host's
  // business and nobody else's, so it's only read for them.
  const [hasSeat, bans] = await Promise.all([
    !room.is_private || isHost
      ? Promise.resolve(true)
      : user
        ? hasAuxSeat(room.id, user.id)
        : Promise.resolve(false),
    isHost ? getAuxBans(room.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <BackToHome />
      <AuxRoom
        initial={state}
        initialMessages={messages}
        initialVote={vote}
        initialReaction={reaction}
        hasSeat={hasSeat}
        initialBans={bans}
        code={code}
      />
    </div>
  );
}
