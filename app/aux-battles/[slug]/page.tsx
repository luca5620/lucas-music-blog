import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  auxRoomExists,
  getAuxMessages,
  getAuxRoomBySlug,
  getAuxRoomState,
  getViewerAuxVote,
} from "@/lib/db/aux-battles";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSafeSlug } from "@/lib/validate";
import AuxRoom from "@/components/aux-battles/AuxRoom";
import CodeGate from "@/components/aux-battles/CodeGate";
import BackToHome from "@/components/ui/BackToHome";

// Rooms move second to second — never cache.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const room = isSafeSlug(slug) ? await getAuxRoomBySlug(slug) : null;
  if (!room) return { title: "Aux Battle" };
  return {
    title: `${room.name} — Aux Battle`,
    description: "Two songs go head to head, the room listens, the room votes.",
  };
}

/**
 * /aux-battles/[slug] — one room. The server loads the bundle (room,
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
  const [state, messages, vote] = await Promise.all([
    getAuxRoomState(room),
    getAuxMessages(room.id),
    user && room.current_game_id ? getViewerAuxVote(room.current_game_id, user.id) : Promise.resolve(null),
  ]);

  // The host of a private room gets the code on first paint.
  let code: string | null = null;
  if (user && room.is_private && room.host_id === user.id) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("aux_room_code", { p_room_id: room.id } as never);
    code = typeof data === "string" ? data : null;
  }

  return (
    <div className="space-y-6">
      <BackToHome />
      <AuxRoom initial={state} initialMessages={messages} initialVote={vote} code={code} />
    </div>
  );
}
