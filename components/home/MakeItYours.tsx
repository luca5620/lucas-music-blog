/**
 * MakeItYours — the customization section on the logged-out home
 * (Luca 2026-09-02: "bring up the level of customization — the
 * immersive profile choices, switching Apple Music / Spotify for
 * previews, etc."). Six cards, each with a live-looking prop rather
 * than a paragraph: theme swatches, showcase chips, the player
 * toggle, the badge, the song + playlist, the taste channel.
 */

import RoleBadge from "@/components/ui/RoleBadge";
import HomeSection from "./HomeSection";
import Reveal from "./Reveal";

/** Mirrors THEMES in app/settings/profile/page.tsx (that list lives in
    a client page — a display copy here keeps this a server module). */
const THEMES: { label: string; hex: string }[] = [
  { label: "Broadcast", hex: "#1e90ff" },
  { label: "PS2 · Nebula", hex: "#8ba7e8" },
  { label: "PS3 · XMB", hex: "#7ec9e8" },
  { label: "PS4", hex: "#4a90d9" },
  { label: "Xbox OG", hex: "#5dc21e" },
  { label: "Xbox 360", hex: "#92c83e" },
  { label: "Wii", hex: "#35b7d8" },
  { label: "LimeWire", hex: "#32cd32" },
  { label: "Soul Reaper", hex: "#e3342f" },
  { label: "Robot Rock", hex: "#f0b93c" },
];

const SHOWCASES = [
  "Taste Readout",
  "Now Showing",
  "Feature Presentation",
  "Mixtapes",
  "Waiting On",
  "On Rotation",
  "Song of the Day",
];

function Card({
  label,
  body,
  children,
}: {
  label: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel-xbox p-5 h-full flex flex-col gap-3 hover-glow relative overflow-hidden">
      <span className="vhs-label text-sm">{label}</span>
      <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
      <div className="mt-auto pt-2">{children}</div>
      <div className="scan-bar" />
    </div>
  );
}

export default function MakeItYours() {
  return (
    <HomeSection
      eyebrow="Make it yours"
      title="A profile that's a channel, not a form."
      sub="Ten themes, showcases you arrange, your own preview player, a song and a playlist on your profile."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        <Reveal delay={0}>
          <Card
            label="Immersive themes"
            body="Ten looks from console eras and internet history. Each one recolors the whole page."
          >
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <span
                  key={t.label}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] text-text-secondary"
                  style={{ borderColor: `${t.hex}55`, background: `${t.hex}12` }}
                  title={t.label}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.hex, boxShadow: `0 0 8px ${t.hex}` }} />
                  {t.label}
                </span>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={90}>
          <Card
            label="Showcases you arrange"
            body="Put the blocks in the order you want: histogram, pinned review, what's on rotation."
          >
            <div className="flex flex-wrap gap-1.5">
              {SHOWCASES.map((s, i) => (
                <span
                  key={s}
                  className={`rounded border px-2 py-1 text-[11px] ${
                    i < 3
                      ? "border-[rgba(var(--accent-rgb),0.5)] bg-[rgba(var(--accent-rgb),0.12)] text-text-primary"
                      : "border-white/10 bg-black/30 text-text-muted"
                  }`}
                >
                  {i < 3 ? `${i + 1} · ` : ""}
                  {s}
                </span>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={180}>
          <Card
            label="Your preview player"
            body="Spotify or Apple Music on every release page. Signed in, previews become full tracks."
          >
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Spotify", true, "#1db954"],
                ["Apple Music", false, "#fa2d48"],
              ].map(([name, on, hex]) => (
                <span
                  key={String(name)}
                  className="rounded-lg border px-3 py-2 text-sm font-bold font-[family-name:var(--font-heading)]"
                  style={{
                    borderColor: on ? String(hex) : "rgba(255,255,255,0.12)",
                    background: on ? `${hex}18` : "rgba(0,0,0,0.25)",
                    color: on ? String(hex) : "#8a8a90",
                  }}
                >
                  {on ? "● " : "○ "}
                  {String(name)}
                </span>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0}>
          <Card
            label="Badges that mean something"
            body="Verified reviewers, early testers, staff, each with its own glow. Regular members don't wear one."
          >
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <RoleBadge role="reviewer" size="sm" showLabel />
              <RoleBadge role="tester" size="sm" showLabel />
              <RoleBadge role="owner" size="sm" showLabel />
            </div>
          </Card>
        </Reveal>

        <Reveal delay={90}>
          <Card
            label="A song and a playlist on the door"
            body="A profile song that plays when someone lands on you, plus a featured Spotify playlist with its own player."
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
                <span className="text-lg">♪</span>
                <span className="min-w-0">
                  <span className="block font-[family-name:var(--font-vt323)] text-[11px] uppercase tracking-wider text-text-muted">
                    Profile song
                  </span>
                  <span className="block text-text-primary truncate font-bold">Your pick — Any artist</span>
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[#1db954]/40 bg-[#1db954]/10 px-3 py-2 text-sm">
                <span className="text-[#1db954]">♫</span>
                <span className="text-text-secondary truncate">Featured playlist · 100 tracks · save it as a list</span>
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={180}>
          <Card
            label="Your Taste, a channel"
            body="A fullscreen feed tuned to who you follow and what you rate, one take at a time, music playing under it."
          >
            <div className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="glow-orb" />
                <span className="vhs-label text-[10px] text-accent-glow">Your taste</span>
                <span className="ml-auto pixel-text text-[10px] text-text-muted">CH 07</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-2/3 rounded-full bg-[rgb(var(--accent-rgb))]" />
              </div>
              <p className="text-xs text-text-secondary truncate">
                next up: a 9.2 from someone you follow
              </p>
            </div>
          </Card>
        </Reveal>
      </div>
    </HomeSection>
  );
}
