import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildAuxDemo } from "@/lib/aux-wars/demo-fixture";
import AuxRoom from "@/components/aux-wars/AuxRoom";
import BackToHome from "@/components/ui/BackToHome";

/**
 * /aux-wars/preview — a STAGED Aux War for screenshots (Luca,
 * 2026-09-28: App Store + Instagram shots of a room mid-vote).
 *
 * It renders the REAL room — the same AuxRoom component every live
 * room uses — fed with fixture data from lib/aux-wars/demo-fixture.ts
 * instead of the database, with AuxRoom's `demo` switch on so nothing
 * on the page reads or writes a room, votes, reactions or chat, and
 * no realtime channel opens. Taps (vote, 🔥/💩, chat) only change
 * this one screen.
 *
 * Why this path can't clash with a real room: Next.js always prefers
 * a static folder (preview/) over the dynamic [slug]/ next to it, and
 * no real room can be called "preview" anyway — every room slug is
 * "<name>-<random suffix>" (app/api/aux-wars/route.ts), so it always
 * has a dash in it.
 *
 * WHO CAN SEE IT (the gate):
 *   - Anywhere that is NOT the live site (VERCEL_ENV !== "production":
 *     `npm run dev`, a local `npm run start`, Vercel preview deploys):
 *     everyone. Handy for checking it on a laptop.
 *   - On the live site: only staff — a profile whose role is "owner"
 *     or "admin", the same two roles every /admin page checks. Luca's
 *     account is the owner. Anyone else (or anyone signed out) gets a
 *     plain 404, so the page doesn't even admit it exists.
 * It isn't linked from anywhere, and robots are told to stay out.
 */

// The gate reads the signed-in session, so this can't be pre-built
// as a static page; and the chat's "3m ago" stamps are worked out
// fresh on every visit.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { state } = buildAuxDemo();
  return {
    // Same title shape as a real room's page.
    title: `${state.room.name} — Aux War`,
    robots: { index: false, follow: false },
  };
}

/** Staff check on the live site; open everywhere else. */
async function canSeePreview(): Promise<boolean> {
  if (process.env.VERCEL_ENV !== "production") return true;
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  return role === "owner" || role === "admin";
}

export default async function AuxWarsPreviewPage() {
  if (!(await canSeePreview())) notFound();

  // Built once per request, so the chat timestamps are relative to NOW.
  const { state, messages, vote, reaction, demo } = buildAuxDemo();

  // Same wrapper and props as app/aux-wars/[slug]/page.tsx, so the
  // staged room sits on the page exactly like a real one. The viewer
  // is a plain crowd member: public room (hasSeat true), not the host
  // (no bans, no code).
  return (
    <div className="space-y-6">
      <BackToHome />
      <AuxRoom
        initial={state}
        initialMessages={messages}
        initialVote={vote}
        initialReaction={reaction}
        hasSeat
        initialBans={[]}
        code={null}
        demo={demo}
      />
    </div>
  );
}
