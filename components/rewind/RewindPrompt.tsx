"use client";

/**
 * RewindPrompt — how people find Peak Music Rewind (Luca 2026-10-25:
 * "how will you present it when december 1st comes? will it be a pop
 * up in the home page").
 *
 * Three ways in, December 1 → January 15:
 *   1. The popup: the FIRST time they open home in the window, a sheet
 *      with their 9 best covers and "Watch now". Shown once per year
 *      (localStorage), never again after Watch now or Not now.
 *   2. This card: sits right under the HOME band for the whole window,
 *      so anyone who closed the popup can still get back in.
 *   3. The push (migration 063): December 1, 10am Eastern, for people
 *      who don't open the app that day.
 * Rendered by app/page.tsx only when getRewindTeaser() says Rewind is
 * open for them and they have 3+ records that year.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import SheetFrame from "@/components/share/SheetFrame";

function Covers({ covers, className }: { covers: (string | null)[]; className: string }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) =>
        covers[i] ? (
          // eslint-disable-next-line @next/next/no-img-element -- Spotify/Genius CDN covers, like the rest of the site
          <img key={i} src={covers[i]!} alt="" />
        ) : (
          <span key={i} />
        )
      )}
    </div>
  );
}

export default function RewindPrompt({ year, covers }: { year: number; covers: (string | null)[] }) {
  const t = useTranslations("rewind");
  const [open, setOpen] = useState(false);

  // First visit this year → open the sheet once. Storage can be
  // missing (private window) — then it simply never pops up and the
  // card does the job.
  useEffect(() => {
    const key = `rewind-intro-${year}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    const id = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(id);
  }, [year]);

  return (
    <>
      <Link href="/rewind" className="rw-card">
        <Covers covers={covers} className="rw-card-grid" />
        <span className="rw-card-text">
          <span className="rw-eyebrow">{t("eyebrow")}</span>
          <b>{t("promptReady", { year })}</b>
          <small>{t("promptLede")}</small>
        </span>
        <span className="rw-card-go" aria-hidden="true">
          ›
        </span>
      </Link>

      {open && (
        <SheetFrame title={t("eyebrow")} closeLabel={t("promptLater")} onClose={() => setOpen(false)}>
          <div className="rw-pop">
            <Covers covers={covers} className="rw-pop-grid" />
            <b>{t("promptReady", { year })}</b>
            <p>{t("promptLede")}</p>
            <div className="rw-end-actions">
              <Link href="/rewind" className="btn-y2k btn-y2k-primary">
                {t("promptWatch")}
              </Link>
              <button type="button" className="btn-y2k btn-y2k-outline" onClick={() => setOpen(false)}>
                {t("promptLater")}
              </button>
            </div>
          </div>
        </SheetFrame>
      )}
    </>
  );
}
