/**
 * MakeItYours — the customization section on the logged-out home
 * (Luca 2026-09-02: "bring up the level of customization — the
 * immersive profile choices, switching Apple Music / Spotify for
 * previews, etc."). Six cards, each with a live-looking prop rather
 * than a paragraph: theme swatches, showcase chips, the player
 * toggle, the badge, the song + playlist, the taste channel.
 *
 * LANGUAGES: server component → getTranslations("home.makeItYours")
 * for the copy and "home.showcases" for the showcase chip names (a
 * namespace the profile editor can reuse when its batch lands). Theme
 * names (Broadcast, PS2 · Nebula, …) are proper names — never
 * translated.
 */

import { getTranslations } from "next-intl/server";
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

/** Keys into home.showcases — the display order of the chips. */
const SHOWCASE_KEYS = [
  "tasteReadout",
  "nowShowing",
  "featurePresentation",
  "mixtapes",
  "waitingOn",
  "onRotation",
  "songOfTheDay",
] as const;

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

export default async function MakeItYours() {
  const t = await getTranslations("home.makeItYours");
  const ts = await getTranslations("home.showcases");

  return (
    <HomeSection eyebrow={t("eyebrow")} title={t("title")} sub={t("sub")}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        <Reveal delay={0}>
          <Card label={t("themesLabel")} body={t("themesBody")}>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((theme) => (
                <span
                  key={theme.label}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] text-text-secondary"
                  style={{ borderColor: `${theme.hex}55`, background: `${theme.hex}12` }}
                  title={theme.label}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: theme.hex, boxShadow: `0 0 8px ${theme.hex}` }} />
                  {theme.label}
                </span>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={90}>
          <Card label={t("showcasesLabel")} body={t("showcasesBody")}>
            <div className="flex flex-wrap gap-1.5">
              {SHOWCASE_KEYS.map((key, i) => (
                <span
                  key={key}
                  className={`rounded border px-2 py-1 text-[11px] ${
                    i < 3
                      ? "border-[rgba(var(--accent-rgb),0.5)] bg-[rgba(var(--accent-rgb),0.12)] text-text-primary"
                      : "border-white/10 bg-black/30 text-text-muted"
                  }`}
                >
                  {i < 3 ? `${i + 1} · ` : ""}
                  {ts(key)}
                </span>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={180}>
          <Card label={t("playerLabel")} body={t("playerBody")}>
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
          <Card label={t("badgesLabel")} body={t("badgesBody")}>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <RoleBadge role="reviewer" size="sm" showLabel />
              <RoleBadge role="tester" size="sm" showLabel />
              <RoleBadge role="owner" size="sm" showLabel />
            </div>
          </Card>
        </Reveal>

        <Reveal delay={90}>
          <Card label={t("songLabel")} body={t("songBody")}>
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
                <span className="text-lg">♪</span>
                <span className="min-w-0">
                  <span className="block font-[family-name:var(--font-vt323)] text-[11px] uppercase tracking-wider text-text-muted">
                    {t("profileSong")}
                  </span>
                  <span className="block text-text-primary truncate font-bold">{t("yourPick")}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[#1db954]/40 bg-[#1db954]/10 px-3 py-2 text-sm">
                <span className="text-[#1db954]">♫</span>
                <span className="text-text-secondary truncate">{t("playlist")}</span>
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={180}>
          <Card label={t("tasteLabel")} body={t("tasteBody")}>
            <div className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="glow-orb" />
                <span className="vhs-label text-[10px] text-accent-glow">{t("tasteTag")}</span>
                <span className="ml-auto pixel-text text-[10px] text-text-muted">CH 07</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-2/3 rounded-full bg-[rgb(var(--accent-rgb))]" />
              </div>
              <p className="text-xs text-text-secondary truncate">{t("nextUp")}</p>
            </div>
          </Card>
        </Reveal>
      </div>
    </HomeSection>
  );
}
