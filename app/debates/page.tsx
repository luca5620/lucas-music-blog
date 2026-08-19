import type { Metadata } from "next";
import Link from "next/link";
import { listDebates } from "@/lib/db/debates";
import DebateCard from "@/components/debates/DebateCard";

export const metadata: Metadata = {
  title: "Debates",
  description:
    "Two sides, one vote, live arguments. Music's eternal questions, settled on air.",
};

// Vote counts and message counts move constantly — always render fresh.
export const dynamic = "force-dynamic";

/**
 * /debates — the arena index.
 * Every debate is a two-sided room: vote a side, argue it live.
 */
export default async function DebatesPage() {
  const debates = await listDebates(24);

  return (
    <div className="space-y-6 circuit-bg">
      {/* ══════════ Header ══════════ */}
      <section className="panel-xbox-glow p-4 sm:p-8 space-y-3 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">Live opinion combat</span>
        </div>
        <h1 className="crt-title text-3xl sm:text-5xl">THE ARENA</h1>
        <p className="text-sm text-text-secondary max-w-xl">
          Two sides. One vote. Endless arguing. Pick where you stand and
          defend it on air — your takes get stamped with your side.
        </p>
        <div className="pt-1">
          <Link href="/debates/new" className="btn-y2k btn-y2k-primary">
            Stake a claim
          </Link>
        </div>
        <div className="scan-bar" />
      </section>

      {/* ══════════ Debate grid ══════════ */}
      {debates.length === 0 ? (
        <div className="panel-xbox p-10 text-center space-y-3">
          <p className="osd-text text-sm">NO SIGNAL</p>
          <p className="text-sm text-text-muted">
            No debates on air yet. Open the first one and pick a fight
            worth having.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {debates.map((d) => (
            <DebateCard key={d.id} debate={d} />
          ))}
        </div>
      )}
    </div>
  );
}
