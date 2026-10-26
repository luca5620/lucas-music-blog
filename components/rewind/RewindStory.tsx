"use client";

/**
 * RewindStory — Peak Music Rewind, the tap-through year (Luca
 * 2026-10-25: "Mix 1, Late-night broadcast", then "cleaner and
 * professional, not crazy and fast").
 *
 * A dark CRT screen (scanlines + vignette) with clean album-style
 * typography inside. Changing screens is a calm channel change: the
 * old picture dims and settles out, a soft band of light scans down
 * the glass, the new picture fades up into place. No static bursts,
 * no colour splits. Plain crossfade under Low detail / reduced motion.
 *
 * Corners (Luca: "no information or USEFUL information"): progress
 * bars along the top, ✕ top-right to leave, the Peak Music mark
 * bottom-right. Nothing else lives in the corners.
 *
 * Screens with nothing to say are skipped (no 10s → "highest score";
 * no Song of the Day → no calendar screen; and so on).
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import RoleBadge from "@/components/ui/RoleBadge";
import type { RewindData, RewindRecord } from "@/lib/rewind";
import type { RewindShareInput } from "@/components/rewind/RewindShareSheet";

const RewindShareSheet = dynamic(() => import("@/components/rewind/RewindShareSheet"), { ssr: false });

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function Cover({ r, className = "" }: { r: { cover: string | null; title: string }; className?: string }) {
  return r.cover ? (
    // eslint-disable-next-line @next/next/no-img-element -- Spotify/Genius CDN covers, like the rest of the site
    <img src={r.cover} alt={r.title} className={`rw-cov ${className}`} />
  ) : (
    <span className={`rw-cov rw-cov-empty ${className}`} aria-label={r.title} />
  );
}

/** The share-card credit line: avatar @handle ✓ · penguin Peak Music
    (drawCredit in lib/share-cards/render.ts, in HTML). */
function Credit({ handle, role, avatarUrl }: { handle: string; role: string | null; avatarUrl: string | null }) {
  return (
    <span className="rw-credit">
      <span className="rw-who">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar from Supabase storage
          <img src={avatarUrl} alt="" />
        ) : (
          <span className="rw-who-blank" />
        )}
        <span>@{handle}</span>
        {role && role !== "user" && (
          <RoleBadge role={role as Parameters<typeof RoleBadge>[0]["role"]} size="xs" />
        )}
      </span>
      <span className="rw-dot" aria-hidden="true" />
      <Brand />
    </span>
  );
}

function Brand() {
  return (
    <span className="rw-brand">
      {/* eslint-disable-next-line @next/next/no-img-element -- the penguin mark, same file the share cards use */}
      <img src="/penguin/mark-192.webp" alt="" />
      Peak Music
    </span>
  );
}

export default function RewindStory({ data, preview }: { data: RewindData; preview: boolean }) {
  const t = useTranslations("rewind");
  const locale = useLocale();
  const [at, setAt] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [scan, setScan] = useState(0);
  const [sharing, setSharing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const monthName = (i: number, style: "long" | "narrow") =>
    new Date(Date.UTC(data.year, i, 15)).toLocaleDateString(locale, { month: style, timeZone: "UTC" });
  const busiest = data.months.indexOf(Math.max(...data.months));
  const grid = useMemo(() => data.top.slice(0, 9), [data]);
  const name = t("coverTitle", { name: data.name, year: data.year });
  const credit = <Credit handle={data.handle} role={data.role} avatarUrl={data.avatarUrl} />;

  // The summary's two ranked columns: top records, then top songs
  // (song-by-song scores) — or top artists when they haven't scored
  // enough songs this year.
  const sumCols = useMemo(() => {
    const cols = [{ label: t("sumRecords"), rows: data.top.slice(0, 5).map((r) => ({ name: r.title, cover: r.cover })) }];
    if (data.songs.length >= 3) cols.push({ label: t("sumSongs"), rows: data.songs.map((s) => ({ name: s.title, cover: s.cover })) });
    else if (data.artists.length >= 2) cols.push({ label: t("sumArtists"), rows: data.artists.map((a) => ({ name: a.name, cover: a.cover })) });
    return cols;
  }, [data, t]);
  // …and the four big numbers.
  const sumStats = useMemo<[string, string][]>(
    () => [
      [String(data.total), t("sumStatRecords")],
      [data.average.toFixed(2), t("sumStatAverage")],
      [String(data.tens), t("sumStatTens")],
      data.sotd
        ? [String(data.sotd.days), t("sumStatSotd")]
        : [new Date(Date.UTC(data.year, busiest, 15)).toLocaleDateString(locale, { month: "long", timeZone: "UTC" }), t("sumStatMonth")],
    ],
    [data, t, busiest, locale]
  );

  const share: RewindShareInput = useMemo(
    () => ({
      year: data.year,
      handle: data.handle,
      role: data.role,
      avatarUrl: data.avatarUrl,
      cover: data.top[0]?.cover ?? null,
      cols: sumCols,
      stats: sumStats,
      labels: { eyebrow: t("eyebrow").toUpperCase(), heading: t("cardHeading", { year: data.year }) },
    }),
    [data, sumCols, sumStats, t]
  );

  /** Change channel to screen `next` (callers check the bounds). */
  function jump(next: number) {
    if (next === at) return;
    if (timer.current) clearTimeout(timer.current);
    setLeaving(at);
    setAt(next);
    setScan((n) => n + 1);
    timer.current = setTimeout(() => setLeaving(null), 420);
  }

  /* ---------- the screens ---------- */
  const screens: React.ReactNode[] = [];

  // 1 · cover
  screens.push(
    <>
      <div className="rw-center">
        <div className="rw-grid">{grid.map((r, i) => <Cover key={i} r={r} />)}</div>
        <div className="rw-title">
          <span className="rw-eyebrow">{t("eyebrow")}</span>
          <b>{name}</b>
          {credit}
        </div>
      </div>
      <p className="rw-hint">{t("tapHint")}</p>
    </>
  );

  // 2 · how many + the year by month
  screens.push(
    <div className="rw-bottom">
      <span className="rw-eyebrow">{t("ratedEyebrow")}</span>
      <div className="rw-num">{data.total}</div>
      <p className="rw-hed">{t("ratedUnit", { n: data.total })}</p>
      <p className="rw-lede">
        {t.rich("ratedLede", {
          avg: data.average.toFixed(2),
          month: monthName(busiest, "long"),
          n: data.months[busiest],
          b: (c) => <b>{c}</b>,
        })}
      </p>
      <div className="rw-months" aria-hidden="true">
        {data.months.map((n, i) => (
          <span key={i} className={i === busiest ? "is-top" : ""}>
            <i style={{ height: `${Math.max(4, (n / Math.max(1, data.months[busiest])) * 100)}%` }} />
            <small>{monthName(i, "narrow")}</small>
          </span>
        ))}
      </div>
    </div>
  );

  // 3 · perfect 10s, or the highest score
  const tens = data.top.filter((r) => r.rating >= 10);
  const below = data.top.find((r) => r.rating < (tens.length ? 10 : data.top[0]?.rating ?? 0));
  if (data.top.length > 0) {
    const shown: RewindRecord[] = tens.length ? tens.slice(0, 2) : data.top.slice(0, 1);
    screens.push(
      <div className="rw-top">
        <span className="rw-eyebrow">{tens.length ? t("tensEyebrow") : t("bestEyebrow")}</span>
        <p className="rw-hed">
          {tens.length ? t("tensHed", { n: data.tens }) : t("bestHed", { score: fmt(data.top[0].rating) })}
        </p>
        <div className={shown.length === 2 ? "rw-pair" : "rw-single"}>
          {shown.map((r, i) => (
            <figure key={i}>
              <Cover r={r} />
              <figcaption>
                <b>{r.title}</b>
                {r.artist} · <span className="rw-score">{fmt(r.rating)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        {data.tens > 2 && <p className="rw-lede">{t("andMore", { n: data.tens - 2 })}</p>}
        {below && (
          <p className="rw-lede">
            {t.rich("closeBehind", { title: below.title, score: fmt(below.rating), b: (c) => <b>{c}</b> })}
          </p>
        )}
      </div>
    );
  }

  // 4 · top 10
  if (data.top.length >= 5) {
    screens.push(
      <div className="rw-top">
        <span className="rw-eyebrow">{t("topEyebrow")}</span>
        <p className="rw-hed rw-hed-sm">{t("topHed", { n: data.top.length })}</p>
        <ol className="rw-tracks">
          {data.top.map((r, i) => (
            <li key={i}>
              <span className="rw-n">{i + 1}</span>
              <Cover r={r} />
              <span className="rw-t">
                <b>{r.title}</b>
                <span>{r.artist}</span>
              </span>
              <span className="rw-score">{fmt(r.rating)}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // 5 · most rated artist
  if (data.artist) {
    const a = data.artist;
    screens.push(
      <div className="rw-bottom">
        <span className="rw-eyebrow">{t("artistEyebrow")}</span>
        <p className="rw-hed rw-hed-lg">{a.name}</p>
        <p className="rw-lede">
          {data.runnerUp
            ? t("artistLedeRunner", { n: a.count, runner: data.runnerUp.name, m: data.runnerUp.count })
            : t("artistLede", { n: a.count })}
        </p>
        <div className="rw-grid rw-grid-gap">
          {a.covers.map((c, i) => (
            <Cover key={i} r={{ cover: c, title: a.name }} />
          ))}
        </div>
      </div>
    );
  }

  // 6 · coldest takes
  if (data.coldest.length > 0) {
    screens.push(
      <div className="rw-top">
        <span className="rw-eyebrow">{t("coldEyebrow")}</span>
        <p className="rw-hed">{t("coldHed")}</p>
        <div className={`${data.coldest.length === 2 ? "rw-pair" : "rw-single"} rw-cold`}>
          {data.coldest.map((r, i) => (
            <figure key={i}>
              <Cover r={r} />
              <figcaption>
                <b>{r.title}</b>
                {r.artist} · <span className="rw-score">{fmt(r.rating)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    );
  }

  // 7 · Song of the Day
  if (data.sotd) {
    const s = data.sotd;
    const picked = new Set(s.picked);
    const days: { day: string; on: boolean }[] = [];
    for (let d = Date.parse(`${s.from}T00:00:00Z`); d <= Date.parse(`${s.to}T00:00:00Z`); d += 86_400_000) {
      const day = new Date(d).toISOString().slice(0, 10);
      days.push({ day, on: picked.has(day) });
    }
    const cols = Math.max(14, Math.ceil(days.length / 12));
    screens.push(
      <div className="rw-bottom">
        <span className="rw-eyebrow">{t("sotdEyebrow")}</span>
        <div className="rw-num">{s.days}</div>
        <p className="rw-hed">{t("sotdUnit", { n: s.days })}</p>
        <div className="rw-cal" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} aria-hidden="true">
          {days.map((d) => (
            <i key={d.day} className={d.on ? "is-on" : ""} />
          ))}
        </div>
        <p className="rw-lede">{t.rich("sotdLede", { n: s.longest, b: (c) => <b>{c}</b> })}</p>
      </div>
    );
  }

  // 8 · the summary (Luca: "the comprehensive look of your top songs
  // and whatnot like how spotify does it, emphasis on the stats, a bit
  // on the artworks"). The #1 record's cover + who it is up top, two
  // ranked columns, then the big numbers. The share card is this same
  // screen (summary in RewindShareInput → drawRewind).
  screens.push(
    <div className="rw-sum">
      <div className="rw-sum-head">
        {data.top[0] && <Cover r={data.top[0]} />}
        <div className="rw-sum-who">
          <span className="rw-eyebrow">{t("eyebrow")}</span>
          <b>{name}</b>
        </div>
      </div>
      {credit}
      <div className="rw-sum-cols">
        {sumCols.map((col) => (
          <div key={col.label}>
            <span className="rw-sum-label">{col.label}</span>
            <ol>
              {col.rows.map((row, i) => (
                <li key={i}>
                  <span className="rw-n">{i + 1}</span>
                  <Cover r={{ cover: row.cover, title: row.name }} />
                  <span className="rw-sum-name">{row.name}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <div className="rw-sum-stats">
        {sumStats.map(([v, k]) => (
          <div key={k}>
            <span className="rw-sum-label">{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <div className="rw-end-actions">
        <button type="button" className="btn-y2k btn-y2k-primary" onClick={() => setSharing(true)}>
          {t("share")}
        </button>
        <button type="button" className="btn-y2k btn-y2k-outline" onClick={() => jump(0)}>
          {t("again")}
        </button>
      </div>
    </div>
  );

  /* ---------- player ---------- */
  // Bounds-checked step (the screen list is built above, so its
  // length is known here).
  function go(next: number) {
    if (next < 0 || next >= screens.length) return;
    jump(next);
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onTap(e: React.MouseEvent<HTMLDivElement>) {
    // Buttons and links inside a screen do their own thing.
    if ((e.target as HTMLElement).closest("a, button")) return;
    const r = e.currentTarget.getBoundingClientRect();
    go(e.clientX - r.left < r.width * 0.33 ? at - 1 : at + 1);
  }
  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      go(at + 1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(at - 1);
    }
  }

  return (
    <div className="rw-wrap">
      <div
        className="rw-screen"
        tabIndex={0}
        role="region"
        aria-roledescription={t("storyRole")}
        aria-label={name}
        onClick={onTap}
        onKeyDown={onKey}
      >
        {screens.map((s, i) => (
          <div
            key={i}
            className={`rw-slide${i === at ? " is-on" : ""}${i === at && leaving !== null ? " is-in" : ""}${i === leaving ? " is-out" : ""}`}
            aria-hidden={i !== at}
          >
            {s}
            <div className="rw-foot">
              <Brand />
            </div>
          </div>
        ))}
        <div className="rw-bars" aria-hidden="true">
          {screens.map((_, i) => (
            <i key={i} className={i <= at ? "is-done" : ""} />
          ))}
        </div>
        <Link href={`/profile/${data.handle}`} className="rw-close" aria-label={t("close")}>
          ✕
        </Link>
        {scan > 0 && <span key={scan} className="rw-scan" aria-hidden="true" />}
      </div>
      <div className="rw-ctrls">
        <button type="button" onClick={() => go(at - 1)} disabled={at === 0} aria-label={t("prev")}>
          ‹
        </button>
        <span>
          {at + 1} / {screens.length}
        </span>
        <button type="button" onClick={() => go(at + 1)} disabled={at === screens.length - 1} aria-label={t("next")}>
          ›
        </button>
      </div>
      {preview && <p className="rw-preview-note">{t("previewNote")}</p>}
      {sharing && <RewindShareSheet input={share} onClose={() => setSharing(false)} />}
    </div>
  );
}
