"use client";

/**
 * MonthShareSheet — "My month on Peak Music" (Luca approved the design
 * as is, 2026-10-24, plus the penguin logo). A still 9:16 card of the
 * member's month: how many records they rated, their average, how many
 * reviews had words, up to five rows, and two awards:
 *   - Top of the month: their highest score.
 *   - Hottest take: the score furthest from everyone else's average on
 *     that record (needs at least one other review of it); with no
 *     comparisons available, their lowest score.
 *
 * The data is read here in the browser with the member's own session
 * (reviews are public, RLS applies as everywhere). ‹ › steps back
 * through the last 12 months.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import SheetFrame from "@/components/share/SheetFrame";
import { createClient } from "@/lib/supabase/client";
import { loadCardAssets, loadImage } from "@/lib/share-cards/assets";
import { CARD_H, CARD_W, SCALE, drawMonth, type CardAssets, type MonthData } from "@/lib/share-cards/render";
import { canvasToPng, shareOrSave } from "@/lib/share-cards/export";
import { hapticTap } from "@/lib/native";

interface Row {
  id: string;
  rating: number;
  title: string;
  artist: string;
  cover_image: string | null;
  release_id: string | null;
  summary: string | null;
  snippet: string | null;
  review_date: string | null;
  created_at: string;
}

const ROWS = 5;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

export default function MonthShareSheet({
  userId,
  handle,
  avatarUrl,
  onClose,
}: {
  userId: string;
  handle: string;
  avatarUrl: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("shareCards");
  const locale = useLocale();
  // 0 = this month, 1 = last month, …
  const [back, setBack] = useState(0);
  const [assets, setAssets] = useState<CardAssets | null>(null);
  const [data, setData] = useState<MonthData | null>(null);
  const [empty, setEmpty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [holdImage, setHoldImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const month = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - back, 1);
  }, [back]);
  const monthLabel = month.toLocaleDateString(locale, { month: "long", year: "numeric" });

  useEffect(() => {
    let alive = true;
    loadCardAssets({ avatarUrl }).then((a) => alive && setAssets(a));
    return () => {
      alive = false;
    };
  }, [avatarUrl]);

  useEffect(() => () => {
    if (holdImage) URL.revokeObjectURL(holdImage);
  }, [holdImage]);

  // Read the month's reviews and work out the card.
  useEffect(() => {
    let alive = true;
    setData(null);
    setEmpty(false);
    (async () => {
      const supabase = createClient();
      const from = iso(month);
      const to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 1));
      // A review belongs to its review_date (the member's own local day);
      // old rows without one fall back to when they were created — the
      // same rule The Log uses.
      const { data: rows } = await supabase
        .from("reviews")
        .select("id, rating, title, artist, cover_image, release_id, summary, snippet, review_date, created_at")
        .eq("user_id", userId)
        .eq("is_published", true)
        .or(
          `and(review_date.gte.${from},review_date.lt.${to}),and(review_date.is.null,created_at.gte.${from},created_at.lt.${to})`
        );
      const list = ((rows ?? []) as Row[])
        .map((r) => ({ ...r, day: r.review_date ?? r.created_at.slice(0, 10) }))
        .sort((a, b) => a.day.localeCompare(b.day));
      if (!alive) return;
      if (list.length === 0) {
        setEmpty(true);
        return;
      }

      // Everyone else's average on the same records, for the hottest take.
      const releaseIds = [...new Set(list.map((r) => r.release_id).filter(Boolean))] as string[];
      const others = new Map<string, { sum: number; n: number }>();
      if (releaseIds.length) {
        const { data: theirs } = await supabase
          .from("reviews")
          .select("release_id, rating")
          .in("release_id", releaseIds)
          .eq("is_published", true)
          .neq("user_id", userId);
        for (const r of (theirs ?? []) as { release_id: string; rating: number }[]) {
          const o = others.get(r.release_id) ?? { sum: 0, n: 0 };
          o.sum += Number(r.rating);
          o.n += 1;
          others.set(r.release_id, o);
        }
      }
      let hottest: Row | null = null;
      let gap = -1;
      for (const r of list) {
        const o = r.release_id ? others.get(r.release_id) : undefined;
        if (!o) continue;
        const g = Math.abs(Number(r.rating) - o.sum / o.n);
        if (g > gap) {
          gap = g;
          hottest = r;
        }
      }
      const byScore = [...list].sort((a, b) => Number(b.rating) - Number(a.rating));
      const top = byScore[0];
      if (!hottest && list.length > 1) hottest = byScore[byScore.length - 1];
      if (hottest && hottest.id === top.id) hottest = list.length > 1 ? byScore[byScore.length - 1] : null;

      // Up to five rows: everything if it fits, else the five best, in date order.
      const shown = (list.length <= ROWS ? list : byScore.slice(0, ROWS)).sort((a, b) =>
        (a.review_date ?? a.created_at).localeCompare(b.review_date ?? b.created_at)
      );
      const covers = await Promise.all(shown.map((r) => loadImage(r.cover_image)));
      if (!alive) return;
      const avg = list.reduce((s, r) => s + Number(r.rating), 0) / list.length;
      setData({
        monthLabel,
        handle,
        rated: list.length,
        average: Math.round(avg * 10) / 10,
        written: list.filter((r) => (r.summary ?? "").trim() || (r.snippet ?? "").trim()).length,
        rows: shown.map((r, i) => ({
          date: new Date((r.review_date ?? r.created_at.slice(0, 10)) + "T12:00:00").toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
          }),
          title: r.title,
          artist: r.artist,
          score: Number(r.rating),
          cover: covers[i],
        })),
        moreCount: list.length - shown.length,
        top: { title: top.title, score: Number(top.rating) },
        hottest: hottest ? { title: hottest.title, score: Number(hottest.rating) } : null,
        labels: {
          heading: t("monthHeading"),
          rated: t("rated"),
          average: t("average"),
          written: t("written"),
          top: t("top"),
          hottest: t("hottest"),
          more: (n) => t("more", { n }),
        },
      });
    })().catch(() => alive && setEmpty(true));
    return () => {
      alive = false;
    };
  }, [month, monthLabel, userId, handle, locale, t]);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !assets || !data) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, CARD_W, CARD_H);
    drawMonth(ctx, assets, data);
  }, [assets, data]);
  useEffect(draw, [draw]);

  async function share() {
    if (!canvasRef.current || !data) return;
    setBusy(true);
    setNote(null);
    hapticTap();
    try {
      const png = await canvasToPng(canvasRef.current);
      const slug = month.toISOString().slice(0, 7);
      const result = await shareOrSave(png, `peak-music-my-month-${slug}.png`, t("monthTitle"));
      if (result === "saved") setNote(t("saved"));
      if (result === "unsupported") {
        setNote(t("longPress"));
        setHoldImage(URL.createObjectURL(png));
      }
    } catch {
      setNote(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SheetFrame title={t("monthTitle")} closeLabel={t("close")} onClose={onClose}>
      <div className="month-share-nav">
        <button type="button" aria-label={t("prevMonth")} disabled={back >= 11 || busy} onClick={() => setBack((b) => b + 1)}>
          ‹
        </button>
        <span>{monthLabel}</span>
        <button type="button" aria-label={t("nextMonth")} disabled={back === 0 || busy} onClick={() => setBack((b) => b - 1)}>
          ›
        </button>
      </div>
      <div className="share-stage">
        {empty ? (
          <p className="share-hint">{t("monthEmpty", { month: monthLabel })}</p>
        ) : (
          <>
            <canvas ref={canvasRef} width={CARD_W * SCALE} height={CARD_H * SCALE} className="share-canvas" aria-label={t("monthTitle")} />
            {(!assets || !data) && <p className="share-stage-wait">{t("preparing")}</p>}
          </>
        )}
      </div>
      {!empty && (
        <div className="share-actions">
          <button type="button" className="btn-y2k btn-y2k-primary disabled:opacity-50" disabled={!data || !assets || busy} onClick={share}>
            {t("shareImage")}
          </button>
        </div>
      )}
      {note && <p className="share-note">{note}</p>}
      {holdImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={holdImage} alt="" className="share-hold-image" />
      )}
    </SheetFrame>
  );
}
