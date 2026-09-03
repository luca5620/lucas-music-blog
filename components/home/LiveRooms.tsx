/**
 * LiveRooms — the live release rooms get their own section on the
 * logged-out home (Luca 2026-09-02: "emphasize the live rooms into
 * its own section" — this is the thing Resonate's listening club
 * isn't). Left: the pitch. Right: a room, drawn as the real chat
 * panel looks. Below: whatever is actually ON AIR right now (rooms
 * with activity in the last 24h), when there is anything.
 */

import Link from "next/link";
import { getReleaseDiscoveryFeed } from "@/lib/db/releases";
import { smallCover } from "@/lib/images";
import LiveBadge from "@/components/rooms/LiveBadge";
import HomeSection from "./HomeSection";
import Reveal from "./Reveal";

/* The handles are Luca's pick (2026-09-02) — personality, not
   placeholders. "you" is the highlighted bubble. */
const MOCK_CHAT = [
  { who: "noobmaster69", text: "track 4 just started. it's the one.", me: false },
  { who: "luca", text: "the sample flip on the outro 😭", me: false },
  { who: "you", text: "nah track 2 clears. argue with me", me: true },
  { who: "champagnepapi", text: "7.8 from me, could go up on a relisten", me: false },
];

export default async function LiveRooms() {
  const feed = await getReleaseDiscoveryFeed(12).catch(() => []);
  // eslint-disable-next-line react-hooks/purity -- server render, read once per request
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const onAir = feed
    .filter((r) => r.last_activity_at && new Date(r.last_activity_at).getTime() > dayAgo)
    .slice(0, 4);

  return (
    <HomeSection
      eyebrow="Live release rooms"
      title="Every release has a room. Midnight is when it fills up."
      sub="The album drops, the room is already open, and the whole platform is in there track by track."
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
        {/* The pitch */}
        <Reveal className="lg:col-span-2">
          <div className="panel-xbox p-5 sm:p-6 h-full flex flex-col gap-4 relative overflow-hidden">
            <ul className="space-y-3 text-sm text-text-secondary leading-relaxed">
              {[
                ["Track by track", "Reactions land as the tracklist plays. You can tell which song the room is on."],
                ["Open before the drop", "Countdown albums get a room before release. The chat is live at 11:59."],
                ["Read without an account", "Rooms are public. Sign up to talk and rate."],
                ["Debates when it gets heated", "Two sides, one record each, the room votes."],
              ].map(([h, b]) => (
                <li key={h} className="flex gap-3">
                  <span className="glow-orb mt-1.5 shrink-0" />
                  <span>
                    <span className="block vhs-label text-[11px] text-text-primary">{h}</span>
                    {b}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-2">
              <Link href="/releases" className="btn-y2k btn-y2k-outline">
                See what&apos;s on air
              </Link>
            </div>
            <div className="scan-bar" />
          </div>
        </Reveal>

        {/* A room, as it looks */}
        <Reveal className="lg:col-span-3" delay={120}>
          <div className="panel-xbox-glow p-4 sm:p-5 h-full flex flex-col gap-3 relative overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="glow-orb" />
                <span className="vhs-label text-xs text-accent-glow">On air</span>
                <span className="text-xs text-text-muted truncate">· release room · 214 in the room</span>
              </div>
              <span className="pixel-text text-[10px] text-osd-amber border border-osd-amber/40 rounded px-1.5 py-0.5">
                NOW PLAYING · 4
              </span>
            </div>
            <div className="flex-1 space-y-2.5 py-1">
              {MOCK_CHAT.map((m) => (
                <div key={m.who + m.text} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm border ${
                      m.me
                        ? "bg-[rgba(var(--accent-rgb),0.14)] border-[rgba(var(--accent-rgb),0.45)] text-text-primary"
                        : "bg-black/40 border-white/10 text-text-secondary"
                    }`}
                  >
                    <span className="block text-[10px] uppercase tracking-widest text-text-muted mb-0.5">
                      {m.who}
                    </span>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="form-input text-sm text-text-muted pointer-events-none select-none">
              say something about track 4…
            </div>
            <div className="scan-bar" />
          </div>
        </Reveal>
      </div>

      {/* Real rooms with a pulse right now */}
      {onAir.length > 0 && (
        <Reveal>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="glow-orb" />
              <span className="vhs-label text-xs">On air right now</span>
              <div className="flex-1 divider-glow" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {onAir.map((r) => (
                <Link key={r.id} href={`/releases/${r.slug}`} className="group space-y-1.5" title={`${r.title} — ${r.primary_artist.name}`}>
                  <span className="poster">
                    {r.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={smallCover(r.cover_image)} alt={`${r.title} cover`} loading="lazy" decoding="async" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-4xl">💿</span>
                    )}
                    <span className="absolute top-1.5 left-1.5">
                      <LiveBadge lastActivityAt={r.last_activity_at} />
                    </span>
                  </span>
                  <span className="block">
                    <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)] group-hover:text-accent-primary transition-colors">
                      {r.title}
                    </span>
                    <span className="block text-xs text-text-secondary truncate">{r.primary_artist.name}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      )}
    </HomeSection>
  );
}
