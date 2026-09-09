"use client";

/**
 * PlayerTabs — ONE card for the listening surface (Luca 2026-09-08:
 * "there are 2 tracklists now" — the Spotify/Apple player carries its
 * own tracklist, and TRACK RATINGS is a second one). The fix he
 * picked: a segmented switch in the card header, PREVIEW | RATINGS,
 * preview by default, a count chip on RATINGS so the scores have
 * scent without being open.
 *
 * Both panes stay MOUNTED — the inactive one is just `hidden` — so
 * flipping to RATINGS never unloads the iframe and the music keeps
 * playing while you rate. The panes are server components passed in
 * as props (the embeds need server-side translations); this client
 * shell only owns the switch.
 */

import { useState, type ReactNode } from "react";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { hapticTap } from "@/lib/native";

interface Props {
  preview: ReactNode;
  ratings: ReactNode;
  /** Total number of track ratings on the release — the chip. */
  ratingsCount: number;
  /** "Spotify clips" / the Apple link — sits right of the tabs while
      the preview is showing. */
  previewNote?: ReactNode;
}

export default function PlayerTabs({ preview, ratings, ratingsCount, previewNote }: Props) {
  const tEmbed = useTranslations("releases.embed");
  const tRatings = useTranslations("releases.trackRatings");
  const [tab, setTab] = useState<"preview" | "ratings">("preview");

  const tabClass = (active: boolean) =>
    `label-xbox px-2.5 py-1 rounded-md transition-colors ${
      active
        ? "bg-accent-primary/15 text-accent-primary"
        : "text-text-muted hover:text-text-primary"
    }`;

  return (
    // Same xl: fill-the-column rule as the old preview card so the
    // bottom edge still lines up with the live room beside it.
    <div className="card-y2k p-4 sm:p-5 space-y-3 overflow-hidden xl:flex-1 xl:flex xl:flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="glow-orb shrink-0" />
          <div
            role="tablist"
            className="flex items-center gap-1 rounded-lg border border-border-subtle p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "preview"}
              onClick={() => {
                hapticTap();
                setTab("preview");
              }}
              className={tabClass(tab === "preview")}
            >
              {tEmbed("preview")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "ratings"}
              onClick={() => {
                hapticTap();
                setTab("ratings");
              }}
              className={`${tabClass(tab === "ratings")} inline-flex items-center gap-1.5`}
            >
              {tRatings("title")}
              {ratingsCount > 0 && (
                <span className="pixel-text text-[10px] tabular-nums px-1.5 rounded border border-current/40">
                  {ratingsCount}
                </span>
              )}
            </button>
          </div>
        </div>
        {tab === "preview" && previewNote}
      </div>

      {/* Preview pane — the iframe keeps playing while hidden. */}
      <div
        role="tabpanel"
        hidden={tab !== "preview"}
        className="xl:flex-1 xl:flex xl:flex-col xl:min-h-0"
      >
        {preview}
      </div>

      {/* Ratings pane — scrolls inside the column on desktop so a
          20-track record doesn't push the live room down. */}
      <div
        role="tabpanel"
        hidden={tab !== "ratings"}
        className="xl:flex-1 xl:min-h-0 xl:overflow-y-auto"
      >
        {ratings}
      </div>
    </div>
  );
}
