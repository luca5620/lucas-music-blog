/**
 * Share cards — the canvas drawings (Luca 2026-10-24, round 3 final
 * verdicts; approved mockups in docs/design/share-cards/).
 *
 * Three cards, all carrying the penguin + "Peak Music" in the
 * PlayStation font:
 *   - STICKER   (drawSticker): see-through glass tinted with the
 *     cover's own colours, the cover with its record spinning behind it
 *     to the right (no score on the record), the score in the rating
 *     colour. Exported as a transparent PNG to drop on a story/video.
 *   - SCORECARD (drawScorecard): a 9:16 video. Cover + spinning record,
 *     the background drifting slowly in the cover's colours, the songs
 *     fading up one after another with their scores, then the album
 *     score eases in and settles — then an 8-second hold so people can
 *     actually read it when it's posted. Round 2 (Luca 2026-10-24:
 *     "softer, professional and cleaner, not volatile and erratic"):
 *     song scores no longer spin from 0 through every colour, the album
 *     score keeps its final colour, rolls only its last point and
 *     never overshoots or pulses, and the background + record move at
 *     about half the speed.
 *     Round 4 (Luca 2026-10-24): song-by-song scores trickle in slowly
 *     — "a bit more of a dramatic reveal" — and each one lands in the
 *     site's classic square rating badge instead of plain text.
 *   - MY MONTH  (drawMonth): a still 9:16 image of a member's month.
 *
 * Everything is drawn in the mockups' 360×640 "card units" and scaled
 * up (SCALE = 3 → 1080×1920, Instagram story size), so the numbers
 * below can be checked against the mockup HTML one to one.
 *
 * Plain Canvas 2D only — no ctx.filter (blur isn't in older iOS
 * Safari), so every soft glow is a radial gradient instead.
 *
 * Banned on purpose (Luca 2026-10-24): nothing borrowed from the
 * Ratings app — no ring score, no barcode, no gradient slider.
 */

import { formatRating, getRatingHex } from "@/lib/rating";

export const CARD_W = 360;
export const CARD_H = 640;
export const SCALE = 3;

/** Everything a card needs that has to be loaded first. */
export interface CardAssets {
  cover: HTMLImageElement | null;
  avatar: HTMLImageElement | null;
  penguin: HTMLImageElement | null;
  /** Up to 3–4 "r, g, b" triplets sampled from the cover. */
  palette: string[];
  /** Canvas font-family strings. */
  sans: string;
  brand: string;
}

/** Fallback colours when the cover can't be sampled (site accent trio). */
export const DEFAULT_PALETTE = ["30, 144, 255", "192, 132, 252", "6, 182, 212"];

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
/** A long, soft settle — fast at first, then a slow glide to rest. */
const easeOutQuart = (x: number) => 1 - Math.pow(1 - clamp01(x), 4);

function font(a: CardAssets, size: number, weight = 400) {
  return `${weight} ${size}px ${a.sans}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Draw an image cropped to fill the box ("object-fit: cover"). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  if (img && img.naturalWidth > 0) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * s;
    const ih = img.naturalHeight * s;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } else {
    // No cover (or it wouldn't load): a plain dark sleeve with a disc.
    ctx.fillStyle = "#1b1b20";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function circleImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, cx: number, cy: number, r: number, fallback = "#2a2a30") {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img && img.naturalWidth > 0) {
    const s = Math.max((2 * r) / img.naturalWidth, (2 * r) / img.naturalHeight);
    const iw = img.naturalWidth * s;
    const ih = img.naturalHeight * s;
    ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
  } else {
    ctx.fillStyle = fallback;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }
  ctx.restore();
}

/** Cut text to fit, with an ellipsis. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid).trimEnd() + "…").width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + "…";
}

/** Word-wrap into at most `maxLines` lines (the last one ellipsised). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxW || !line) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines - 1) {
        line = fit(ctx, [line, ...words.slice(i + 1)].join(" "), maxW);
        break;
      }
    }
  }
  if (line) lines.push(lines.length === maxLines - 1 ? fit(ctx, line, maxW) : line);
  return lines.slice(0, maxLines);
}

/** A soft round glow of one colour (stands in for a blurred blob). */
/** "#rrggbb" → "r, g, b" for glowBlob. */
function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * The site's classic square rating badge, centred on (cx, cy): dark
 * fill, a border in the rating colour, the score in the same colour.
 * The special bands carry over — 10 is white ink with a blue glow,
 * 9.5+ glows purple, 0–1.9 gets the darker brown border.
 */
function drawScoreBadge(ctx: CanvasRenderingContext2D, a: CardAssets, score: number, cx: number, cy: number, w: number, h: number) {
  const color = getRatingHex(score);
  const perfect = score === 10;
  const elite = !perfect && score >= 9.5;
  ctx.save();
  if (perfect || elite) {
    ctx.shadowColor = perfect ? "rgba(30, 144, 255, 0.95)" : "rgba(168, 85, 247, 0.9)";
    ctx.shadowBlur = h * 0.7;
  }
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h * 0.24);
  ctx.fillStyle = "rgba(6, 8, 14, 0.62)";
  ctx.fill();
  ctx.lineWidth = Math.max(1, h * 0.1);
  ctx.strokeStyle = score < 2 ? "#7a5735" : color;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = perfect ? "#ffffff" : color;
  ctx.font = font(a, h * 0.56, 800);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(formatRating(score), cx, cy + h * 0.04);
  ctx.restore();
}

function glowBlob(ctx: CanvasRenderingContext2D, rgb: string, cx: number, cy: number, r: number, alpha: number) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  g.addColorStop(0.55, `rgba(${rgb}, ${alpha * 0.6})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
}

/** A vinyl record: grooves, an optional cover label, the spindle hole. */
function drawDisc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, angle: number, label: HTMLImageElement | null, labelR: number, pitch: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = "#0d0d0f";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1b1b1f";
  ctx.lineWidth = pitch * 0.38;
  for (let rr = labelR + pitch; rr < r - 1; rr += pitch) {
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The cover as the centre label (it turns with the record).
  circleImage(ctx, label, 0, 0, labelR, "#2a2a30");
  ctx.fillStyle = "#040405";
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.5, labelR * 0.11), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // A still sheen across the grooves — light doesn't turn with the record.
  const c = ctx as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient };
  if (typeof c.createConicGradient === "function") {
    const g = c.createConicGradient((300 * Math.PI) / 180 - Math.PI / 2, cx, cy);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(25 / 360, "rgba(255,255,255,0.16)");
    g.addColorStop(60 / 360, "rgba(255,255,255,0)");
    g.addColorStop(180 / 360, "rgba(255,255,255,0)");
    g.addColorStop(205 / 360, "rgba(255,255,255,0.1)");
    g.addColorStop(240 / 360, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.restore();
  }
}

/** Penguin + "Peak Music" (PlayStation font). align = which edge x is. */
function drawBrand(ctx: CanvasRenderingContext2D, a: CardAssets, x: number, cy: number, align: "left" | "right", size = 14, color = "rgba(255,255,255,0.92)") {
  ctx.font = `${size}px ${a.brand}`;
  const textW = ctx.measureText("Peak Music").width;
  const icon = size * 1.57;
  const total = icon + 6 + textW;
  const left = align === "left" ? x : x - total;
  if (a.penguin && a.penguin.naturalWidth > 0) {
    const s = Math.min(icon / a.penguin.naturalWidth, icon / a.penguin.naturalHeight);
    const w = a.penguin.naturalWidth * s;
    const h = a.penguin.naturalHeight * s;
    ctx.drawImage(a.penguin, left + (icon - w) / 2, cy - h / 2, w, h);
  }
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Peak Music", left + icon + 6, cy + size * 0.06);
}

/**
 * The verification checkmark next to a handle (Luca 2026-10-25: "the
 * checkmarks too, in any share feature with the @"). Same badge as
 * components/ui/RoleBadge.tsx: a tinted circle with a check, gold for
 * the Founder ('owner'), site blue for Admin, green for Verified
 * Reviewer, purple for Early Tester, silver for Supporter; all but the
 * reviewer green and the supporter silver have the strong glow.
 * Regular members ('user', or no role) get nothing. Keep these colours
 * in step with RoleBadge's badgeConfig.
 */
const ROLE_BADGES: Record<string, { color: string; glow: boolean }> = {
  owner: { color: "#fbbf24", glow: true },
  admin: { color: "#1e90ff", glow: true },
  reviewer: { color: "#22c55e", glow: false },
  tester: { color: "#a855f7", glow: true },
  supporter: { color: "#e2e8f0", glow: false },
};

/** Width the badge adds after the handle (gap + circle), 0 for none. */
function roleBadgeWidth(role: string | null | undefined, size: number) {
  return role && ROLE_BADGES[role] ? 4 + size * 1.15 : 0;
}

/** Draw the badge with its left edge at x, centred on cy. */
function drawRoleBadge(ctx: CanvasRenderingContext2D, role: string | null | undefined, x: number, cy: number, size: number) {
  const b = role ? ROLE_BADGES[role] : undefined;
  if (!b) return;
  const r = (size * 1.15) / 2;
  const cx = x + r;
  // RoleBadge's art is a 24-unit box with a r=10 circle; u = one unit
  const u = r / 10;
  ctx.save();
  if (b.glow) {
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 6;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r - u, 0, Math.PI * 2);
  ctx.fillStyle = `${b.color}33`;
  ctx.fill();
  ctx.lineWidth = 2 * u;
  ctx.strokeStyle = b.color;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(cx - 3 * u, cy);
  ctx.lineTo(cx - 1 * u, cy + 2 * u);
  ctx.lineTo(cx + 3 * u, cy - 2 * u);
  ctx.lineWidth = 2.5 * u;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

/** Avatar + @handle (+ the verification check for verified roles).
    align = which edge x is. maxW caps the whole thing (avatar and
    check included); a longer handle ends in an ellipsis. */
function drawWho(ctx: CanvasRenderingContext2D, a: CardAssets, handle: string, x: number, cy: number, align: "left" | "right", size = 12, color = "#fff", maxW = Infinity, role: string | null = null) {
  ctx.font = font(a, size, 600);
  const badgeW = roleBadgeWidth(role, size);
  const label = Number.isFinite(maxW) ? fit(ctx, `@${handle}`, maxW - size * 1.83 - 7 - badgeW) : `@${handle}`;
  const tw = ctx.measureText(label).width;
  const av = size * 1.83;
  const left = align === "left" ? x : x - (av + 7 + tw + badgeW);
  circleImage(ctx, a.avatar, left + av / 2, cy, av / 2, "#3a3a44");
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, left + av + 7, cy + 0.5);
  drawRoleBadge(ctx, role, left + av + 7 + tw + 4, cy, size);
}

/**
 * "@handle · Peak Music" on ONE line (Luca 2026-10-25). Both cards used
 * to put the handle bottom-left and the brand bottom-right, which is
 * exactly where TikTok / Reels lay their username + caption over the
 * video. Now it sits in the middle of the card, under the title.
 * align "center" centres the whole line on x; "left" starts it at x.
 * maxW caps the line; a long handle ends in an ellipsis. role adds the
 * verification check after the handle.
 */
function drawCredit(ctx: CanvasRenderingContext2D, a: CardAssets, handle: string, x: number, cy: number, align: "left" | "center", maxW: number, role: string | null = null) {
  const size = 11.5;
  const bsize = 12.5;
  ctx.font = `${bsize}px ${a.brand}`;
  const brandW = bsize * 1.57 + 6 + ctx.measureText("Peak Music").width;
  const sep = 18; // room for the dot between the two halves
  const av = size * 1.83;
  const badgeW = roleBadgeWidth(role, size);
  ctx.font = font(a, size, 600);
  const label = fit(ctx, `@${handle}`, maxW - brandW - sep - av - 7 - badgeW);
  const whoW = av + 7 + ctx.measureText(label).width + badgeW;
  const left = align === "center" ? x - (whoW + sep + brandW) / 2 : x;
  drawWho(ctx, a, label.slice(1), left, cy, "left", size, "#fff", Infinity, role);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(left + whoW + sep / 2, cy, 1.4, 0, Math.PI * 2);
  ctx.fill();
  drawBrand(ctx, a, left + whoW + sep, cy, "left", bsize);
}

/**
 * Odometer number: one rolling column for the whole number, one for
 * the tenths. As `v` climbs, the digits spin past and the colour walks
 * through the rating colours. Drawn with its right edge at `right`
 * (or centred on `center` when given). Returns the drawn width.
 */
function drawOdometer(
  ctx: CanvasRenderingContext2D,
  a: CardAssets,
  v: number,
  opts: { right?: number; center?: number; baseline: number; size: number; weight: number; color?: string }
): number {
  const { size, weight, baseline } = opts;
  const n = Math.max(0, Math.min(100, v * 10));
  const tenthsPos = n % 10;
  const unitsPos = Math.floor(n / 10) + Math.min(Math.max(tenthsPos - 9, 0), 1);
  ctx.font = font(a, size, weight);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  const label = (i: number) => (i >= 10 ? "10" : String(i));
  const uLo = Math.floor(unitsPos);
  // The whole-number column is as wide as the digit showing — easing
  // toward the next one while it rolls in ("9" → "10" widens smoothly)
  // so a resting number never has a gap before its dot.
  const uFrac = unitsPos - uLo;
  const wLo = ctx.measureText(label(Math.min(uLo, 10))).width;
  const wHi = ctx.measureText(label(Math.min(uLo + 1, 10))).width;
  const uW = wLo + (wHi - wLo) * uFrac;
  const digitW = ctx.measureText("0").width;
  const dotW = ctx.measureText(".").width;
  const total = uW + dotW + digitW;
  const left = opts.center !== undefined ? opts.center - total / 2 : (opts.right ?? 0) - total;
  ctx.fillStyle = opts.color ?? getRatingHex(Math.round(v * 10) / 10);

  const column = (pos: number, cx: number, w: number, labels: (i: number) => string, max: number) => {
    const lo = Math.floor(pos);
    const frac = pos - lo;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - w / 2 - 2, baseline - size * 0.98, w + 4, size * 1.2);
    ctx.clip();
    ctx.fillText(labels(Math.min(lo, max)), cx, baseline - frac * size);
    if (frac > 0.001) ctx.fillText(labels(Math.min(lo + 1, max)), cx, baseline + (1 - frac) * size);
    ctx.restore();
  };
  column(unitsPos, left + uW / 2, uW, label, 10);
  ctx.fillText(".", left + uW + dotW / 2, baseline);
  column(tenthsPos, left + uW + dotW + digitW / 2, digitW, (i) => String(i % 10), 10);
  return total;
}

/** The moving cover-colour liquid behind the scorecard. */
function drawLiquid(ctx: CanvasRenderingContext2D, palette: string[], t: number) {
  ctx.fillStyle = "#040405";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const pal = palette.length >= 4 ? palette : [...palette, ...DEFAULT_PALETTE].slice(0, 4);
  pal.slice(0, 4).forEach((rgb, i) => {
    const s = 260 + i * 40;
    // slow drift (was 0.35 + i·0.07 — too busy behind the numbers)
    const ang = t * (0.16 + i * 0.035) + i * 1.7;
    const cx = 180 + Math.cos(ang) * 90 + (i - 1.5) * 40;
    const cy = 160 + Math.sin(ang * 1.2) * 110 + i * 120;
    glowBlob(ctx, rgb, cx, cy, s / 2 + 46, 0.7);
  });
  const shade = ctx.createLinearGradient(0, 0, 0, CARD_H);
  shade.addColorStop(0, "rgba(0,0,0,0.05)");
  shade.addColorStop(0.42, "rgba(0,0,0,0.45)");
  shade.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

/* ------------------------------------------------------------------ */
/* 1 · The album scorecard (video)                                     */
/* ------------------------------------------------------------------ */

export interface ScorecardData {
  title: string;
  /** "Daft Punk · 2001" */
  subtitle: string;
  rating: number;
  handle: string;
  /** profiles.role: verified roles get the checkmark after the handle. */
  role?: string | null;
  /** Song scores in album order; empty = a whole-album review. */
  songs: { n: number; title: string; score: number }[];
  /** Shown in place of the song list when there are no song scores. */
  quote: string | null;
  labels: { songsProgress: (done: number, total: number) => string; outOf: string; more: (n: number) => string };
}

const SC_T0 = 1.0;
/** How long after its row a song's score lands, and how long it takes.
    Round 4: a longer beat between the title and its score — the reveal. */
const SC_SCORE_DELAY = 0.4;
const SC_FADE = 0.55;
/** A score's badge settles from a little bigger into place. */
const SC_LAND = 0.5;
/** The album score's ease-in. */
const SC_OV = 1.6;
/** Luca: "a 5-10 second buffer after for people to read the number
    ratings with ample time when people post it". */
export const SCORECARD_HOLD = 8;

function scorecardTiming(count: number) {
  // Round 4: about twice as slow as before — up to 0.75s per song, and
  // a long album spreads over ~8s instead of racing (was 0.3s / 4.4s).
  const step = count > 0 ? Math.min(0.75, 8 / count) : 0;
  const ov0 = count > 0 ? SC_T0 + count * step + SC_SCORE_DELAY + SC_FADE : 1.2;
  return { step, ov0, end: ov0 + SC_OV };
}

/** Total video length in seconds (roll-in + roll-up + the hold). */
export function scorecardDuration(data: ScorecardData): number {
  return scorecardTiming(data.songs.length).end + SCORECARD_HOLD;
}

/** Draw one frame of the scorecard at time `t` (seconds). ctx is pre-scaled. */
/**
 * The scorecard's side margins (Luca 2026-10-25). Everything sits
 * between SC_X and SC_R, the same distance in from both edges, so the
 * song scores on the right stay clear of TikTok's like / comment /
 * share column (and Reels' buttons) and the card still looks centred.
 * Was 24 / 336, edge to edge.
 *
 * Top to bottom (reordered 2026-10-25): record, title, the credit line,
 * the score, the songs, and then NOTHING below about y 505, so TikTok /
 * Reels can lay their username + caption over the bottom fifth without
 * covering anything. The record shrank a little (146 → 120) to make the
 * room, so a 17-song album still shows every song.
 */
/** How much smaller the record is than it was drawn (146 → 120). */
const SC_REC = 120 / 146;
/** Where the song list starts and the last pixel it may use. */
const SC_LIST_TOP = 276;
const SC_LIST_END = 505;
const SC_X = 54;
const SC_R = CARD_W - SC_X;
const SC_INNER = SC_R - SC_X;

export function drawScorecard(ctx: CanvasRenderingContext2D, a: CardAssets, d: ScorecardData, t: number) {
  drawLiquid(ctx, a.palette, t);
  const intro = easeOut(t / 0.9);

  // The record: cover with the record behind it to the right, spinning.
  ctx.save();
  ctx.globalAlpha = intro;
  const recW = 210;
  const scale = 0.9 + 0.1 * intro;
  ctx.translate(CARD_W / 2, 22 + 73 * SC_REC);
  ctx.scale(scale * SC_REC, scale * SC_REC);
  ctx.translate(-recW / 2, -73);
  // a calm turn (was 200°/s)
  drawDisc(ctx, 72 + 69, 4 + 69, 69, (t * 110 * Math.PI) / 180, a.cover, 28, 2.6);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, 0, 0, 146, 146, 5);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
  drawCover(ctx, a.cover, 0, 0, 146, 146, 5);
  ctx.restore();

  // Title + artist
  ctx.save();
  ctx.globalAlpha = intro;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.font = font(a, 20, 700);
  ctx.fillText(fit(ctx, d.title, SC_INNER), CARD_W / 2, 166 + (1 - intro) * 8);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = font(a, 12, 400);
  ctx.fillText(fit(ctx, d.subtitle, SC_INNER), CARD_W / 2, 181 + (1 - intro) * 8);
  // who made it + Peak Music, out of the caption corner
  drawCredit(ctx, a, d.handle, CARD_W / 2, 203 + (1 - intro) * 8, "center", SC_INNER, d.role ?? null);
  ctx.restore();

  const { step, ov0 } = scorecardTiming(d.songs.length);

  // Song rows
  const top = SC_LIST_TOP;
  const room = SC_LIST_END - SC_LIST_TOP;
  let rowH = d.songs.length ? Math.min(21, room / d.songs.length) : 21;
  let visible = d.songs;
  let hidden = 0;
  if (rowH < 13) {
    rowH = 13;
    const fitRows = Math.floor(room / rowH) - 1;
    visible = d.songs.slice(0, fitRows);
    hidden = d.songs.length - fitRows;
  }
  const fs = Math.max(8.5, rowH * 0.57);
  let done = 0;
  d.songs.forEach((song, i) => {
    const s = SC_T0 + i * step;
    if (t >= s + SC_SCORE_DELAY) done++;
    if (i >= visible.length) return;
    // The row fades up a few units into place…
    const k = easeOut((t - s) / SC_FADE);
    if (k <= 0) return;
    const y = top + i * rowH;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 5);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(SC_X, y, SC_INNER, 0.5);
    const mid = y + rowH / 2 + fs * 0.36;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = font(a, fs * 0.875, 400);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText(String(song.n), SC_X, mid);
    ctx.font = font(a, fs, 400);
    ctx.fillStyle = "#fff";
    ctx.fillText(fit(ctx, song.title, SC_INNER - 20 - 44), SC_X + 20, mid);
    // …and its score lands a beat later in the classic square badge,
    // already at its value and colour (no counting up): it fades in
    // while shrinking from a touch bigger into place, with a soft flash
    // of its colour behind it that dies away.
    const land = (t - s - SC_SCORE_DELAY) / SC_LAND;
    if (land > 0) {
      const kl = easeOut(land);
      const bh = Math.min(rowH * 0.82, 18);
      const bw = bh * 1.34;
      const bx = SC_R - bw / 2;
      const by = y + rowH / 2;
      ctx.globalAlpha = k * kl;
      if (land < 1) glowBlob(ctx, hexToRgb(getRatingHex(song.score)), bx, by, bh * 1.6, 0.5 * (1 - kl));
      ctx.save();
      ctx.translate(bx, by);
      const sc = 1 + 0.22 * (1 - kl);
      ctx.scale(sc, sc);
      drawScoreBadge(ctx, a, song.score, 0, 0, bw, bh);
      ctx.restore();
    }
    ctx.restore();
  });
  if (hidden > 0 && t >= SC_T0 + visible.length * step) {
    ctx.font = font(a, 10.5, 500);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "left";
    ctx.fillText(d.labels.more(hidden), SC_X + 20, top + visible.length * rowH + rowH * 0.72);
  }
  // A whole-album review: their one-liner where the songs would be.
  if (d.songs.length === 0 && d.quote) {
    const k = easeOut((t - 0.6) / 0.6);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.font = font(a, 17, 500);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    wrap(ctx, `“${d.quote}”`, SC_INNER - 22, 6).forEach((line, i) => ctx.fillText(line, CARD_W / 2, 300 + i * 25));
    ctx.restore();
  }

  // The album score: "x of n songs" while they roll in, then it rolls up.
  // The progress line fades out as the score fades in (a crossfade,
  // not a cut).
  if (d.songs.length && t < ov0 + 0.35) {
    ctx.save();
    ctx.globalAlpha = 1 - clamp01((t - ov0) / 0.35);
    ctx.font = font(a, 11.5, 500);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.textAlign = "center";
    ctx.fillText(d.labels.songsProgress(done, d.songs.length), CARD_W / 2, 254);
    ctx.restore();
  }
  if (t >= ov0) {
    // Fades up while its last point rolls into place, slowing to a
    // stop. Final colour from the first frame; no overshoot, no pulse.
    const p = (t - ov0) / SC_OV;
    const from = Math.max(0, d.rating - 1);
    const v = from + (d.rating - from) * easeOutQuart(p);
    const color = getRatingHex(d.rating);
    ctx.save();
    ctx.globalAlpha = easeOut(p / 0.45);
    ctx.translate(CARD_W / 2, 250 + (1 - easeOut(p / 0.6)) * 8);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * easeOut(p);
    ctx.font = font(a, 14, 600);
    const ofW = ctx.measureText(d.labels.outOf).width;
    ctx.font = font(a, 54, 800);
    // measure the number by drawing it off to the side first
    const numW = drawOdometer(ctx, a, Math.max(0, v), { center: -9999, baseline: -9999, size: 54, weight: 800 });
    const gap = 4;
    const left = -(numW + gap + ofW) / 2;
    drawOdometer(ctx, a, Math.max(0, v), { right: left + numW, baseline: 14, size: 54, weight: 800, color });
    ctx.shadowBlur = 0;
    ctx.font = font(a, 14, 600);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "left";
    ctx.fillText(d.labels.outOf, left + numW + gap, 8);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* 2 · The sticker                                                     */
/* ------------------------------------------------------------------ */

export interface StickerData {
  title: string;
  /** "fakemink · Single" */
  subtitle: string;
  rating: number;
  handle: string;
  /** profiles.role: verified roles get the checkmark after the handle. */
  role?: string | null;
  quote: string | null;
  labels: { outOf: string };
}

/** Sticker card size in card units; height depends on the quote. */
export function stickerSize(ctx: CanvasRenderingContext2D, a: CardAssets, d: StickerData) {
  const w = 324;
  ctx.font = font(a, 14.5, 500);
  const lines = d.quote ? wrap(ctx, `“${d.quote}”`, w - 32, 4).length : 0;
  const h = 14 + 22 + 13 + 78 + (lines ? 12 + lines * 20.3 : 0) + 16;
  return { w, h };
}

/** Loop length of the sticker's swirl (seconds) — loops cleanly. */
export const STICKER_LOOP = 6;

/**
 * Draw the sticker with its top-left at (x, y), at time t. The glass is
 * semi-transparent, so on a transparent canvas whatever it's placed on
 * shows through.
 */
export function drawSticker(ctx: CanvasRenderingContext2D, a: CardAssets, d: StickerData, t: number, x: number, y: number) {
  const { w, h } = stickerSize(ctx, a, d);
  ctx.save();
  ctx.translate(x, y);

  // Drop shadow under the glass
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, 0, 0, w, h, 26);
  ctx.fillStyle = "rgba(10,14,30,0.22)";
  ctx.fill();
  ctx.restore();

  // The tint: the cover's colours slowly swirling inside the glass.
  ctx.save();
  roundRect(ctx, 0, 0, w, h, 26);
  ctx.clip();
  const pal = (a.palette.length ? a.palette : DEFAULT_PALETTE).slice(0, 3);
  const omega = (Math.PI * 2) / STICKER_LOOP;
  pal.forEach((rgb, i) => {
    const ang = t * omega + i * 2.1;
    glowBlob(ctx, rgb, 150 - 18 + Math.cos(ang) * 110 + 18, 95 + Math.sin(ang) * 60, 105 + 30, 0.78);
  });
  const glass = ctx.createLinearGradient(0, 0, w * 0.34, h);
  glass.addColorStop(0, "rgba(255,255,255,0.14)");
  glass.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = glass;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // Glass edge
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 26);
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Row 1: brand left, who right
  drawBrand(ctx, a, 16, 25, "left", 14, "#fff");
  drawWho(ctx, a, d.handle, w - 16, 25, "right", 12.5, "#fff", Infinity, d.role ?? null);

  // Row 2: the sleeve (cover + record spinning behind it, no score on it)
  const r2 = 49;
  drawDisc(ctx, 16 + 38 + 36, r2 + 3 + 36, 36, (t * 120 * Math.PI) / 180, a.cover, 11, 2.4);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, 16, r2, 78, 78, 6);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
  drawCover(ctx, a.cover, 16, r2, 78, 78, 6);

  // Score, right-aligned, in the rating colour with a soft glow
  const color = getRatingHex(d.rating);
  ctx.font = font(a, 36, 800);
  const scoreText = d.rating.toFixed(1);
  const scoreW = ctx.measureText(scoreText).width;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = mixWhite(color, 0.3);
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(scoreText, w - 16, r2 + 44);
  ctx.restore();
  ctx.font = font(a, 10.5, 400);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.textAlign = "right";
  ctx.fillText(d.labels.outOf, w - 16, r2 + 59);

  // Title + subtitle between the sleeve and the score
  const tx = 16 + 112 + 13;
  const tw = w - 16 - Math.max(scoreW, 50) - 10 - tx;
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = font(a, 16.5, 700);
  const tl = wrap(ctx, d.title, tw, 2);
  const blockH = tl.length * 19 + 17;
  let ty = r2 + 39 - blockH / 2 + 14;
  tl.forEach((line) => {
    ctx.fillText(line, tx, ty);
    ty += 19;
  });
  ctx.font = font(a, 12.5, 400);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  // "Artist · Single" when it fits, else just the artist.
  const sub = ctx.measureText(d.subtitle).width <= tw ? d.subtitle : d.subtitle.split(" · ")[0];
  ctx.fillText(fit(ctx, sub, tw), tx, ty + 1);

  // Their one-liner
  if (d.quote) {
    ctx.font = font(a, 14.5, 500);
    ctx.fillStyle = "#fff";
    wrap(ctx, `“${d.quote}”`, w - 32, 4).forEach((line, i) => ctx.fillText(line, 16, r2 + 78 + 12 + 15 + i * 20.3));
  }
  ctx.restore();
}

/**
 * The sticker as the sheet previews it: on a stand-in "story" (the
 * cover's liquid, dimmed) so the see-through glass reads. The exported
 * PNG is the sticker alone on transparent pixels (drawSticker).
 */
export function drawStickerPreview(ctx: CanvasRenderingContext2D, a: CardAssets, d: StickerData, t: number) {
  drawLiquid(ctx, a.palette, t * 0.6);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const { h } = stickerSize(ctx, a, d);
  drawSticker(ctx, a, d, t, 18, Math.max(60, (CARD_H - h) / 2 - 60));
}

/** Lighten a #rrggbb colour toward white by `k` (0–1). */
function mixWhite(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * k);
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

/* ------------------------------------------------------------------ */
/* 3 · My month (still)                                                */
/* ------------------------------------------------------------------ */

export interface MonthRow {
  date: string;
  title: string;
  artist: string;
  score: number;
  cover: HTMLImageElement | null;
}

export interface MonthData {
  monthLabel: string;
  handle: string;
  /** profiles.role: verified roles get the checkmark after the handle. */
  role?: string | null;

  rated: number;
  average: number | null;
  written: number;
  rows: MonthRow[];
  /** More reviews than rows shown. */
  moreCount: number;
  top: { title: string; score: number } | null;
  hottest: { title: string; score: number } | null;
  labels: {
    heading: string; // "My month on\nPeak Music"
    rated: string;
    average: string;
    written: string;
    top: string;
    hottest: string;
    more: (n: number) => string;
  };
}

export function drawMonth(ctx: CanvasRenderingContext2D, a: CardAssets, d: MonthData) {
  ctx.fillStyle = "#050506";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // the blue glow in the top-left
  ctx.save();
  ctx.translate(180, 50);
  ctx.scale(1, 190 / 240);
  glowBlob(ctx, "30, 144, 255", 0, 0, 240, 0.25);
  ctx.restore();

  // Safe zones (Luca 2026-10-25, same as the scorecard): the same
  // margins as SC_X on both sides (scores on the right stay clear of
  // TikTok's buttons), nothing in the top-left corner (Instagram
  // Stories puts the poster's name there), the credit line under the
  // stats instead of bottom-left, and everything done by about y 515
  // so a caption never covers it. Rows got a little slimmer for that.
  const L = SC_X;
  const R = SC_R;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = font(a, 12, 600);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(d.monthLabel, L, 74);
  ctx.font = font(a, 24, 800);
  ctx.fillStyle = "#fff";
  d.labels.heading.split("\n").forEach((line, i) => ctx.fillText(fit(ctx, line, R - L), L, 104 + i * 26));

  // stats
  const stats: [string, string][] = [
    [String(d.rated), d.labels.rated],
    [d.average === null ? "–" : d.average.toFixed(1), d.labels.average],
    [String(d.written), d.labels.written],
  ];
  let sx = L;
  stats.forEach(([v, k]) => {
    ctx.font = font(a, 20, 700);
    ctx.fillStyle = "#fff";
    ctx.fillText(v, sx, 166);
    const vw = ctx.measureText(v).width;
    ctx.font = font(a, 11, 400);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(k, sx, 181);
    sx += Math.max(vw, ctx.measureText(k).width) + 18;
  });

  // who made it + Peak Music, out of the caption corner
  drawCredit(ctx, a, d.handle, L, 204, "left", R - L, d.role ?? null);

  // the list
  let y = 222;
  d.rows.forEach((row) => {
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.fillRect(L, y, R - L, 0.5);
    const cy = y + 20;
    ctx.font = font(a, 10.5, 600);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "left";
    ctx.fillText(row.date, L, cy + 4);
    drawCover(ctx, row.cover, L + 42, cy - 16, 32, 32, 6);
    ctx.font = font(a, 17, 700);
    const sc = row.score.toFixed(1).replace(/\.0$/, "");
    const sw = ctx.measureText(sc).width;
    ctx.fillStyle = getRatingHex(row.score);
    ctx.textAlign = "right";
    ctx.fillText(sc, R, cy + 6);
    ctx.textAlign = "left";
    const tx = L + 42 + 32 + 10;
    const tw = R - sw - 10 - tx;
    ctx.font = font(a, 13, 600);
    ctx.fillStyle = "#fff";
    ctx.fillText(fit(ctx, row.title, tw), tx, cy - 2);
    ctx.font = font(a, 11, 400);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(fit(ctx, row.artist, tw), tx, cy + 12);
    y += 40;
  });
  if (d.moreCount > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.fillRect(L, y, R - L, 0.5);
    ctx.font = font(a, 11, 500);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(d.labels.more(d.moreCount), L, y + 18);
    y += 24;
  }

  // the two awards
  const awards: [string, { title: string; score: number } | null][] = [
    [d.labels.top, d.top],
    [d.labels.hottest, d.hottest],
  ];
  const boxW = (R - L - 10) / 2;
  y += 10;
  awards.forEach(([k, v], i) => {
    if (!v) return;
    const bx = L + i * (boxW + 10);
    roundRect(ctx, bx, y, boxW, 64, 14);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.textAlign = "left";
    ctx.font = font(a, 10.5, 600);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(fit(ctx, k, boxW - 24), bx + 12, y + 18);
    ctx.font = font(a, 22, 700);
    ctx.fillStyle = getRatingHex(v.score);
    ctx.fillText(v.score.toFixed(1).replace(/\.0$/, ""), bx + 12, y + 41);
    ctx.font = font(a, 11.5, 400);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(fit(ctx, v.title, boxW - 24), bx + 12, y + 57);
  });
}

/* ------------------------------------------------------------------ */
/* 4 · Peak Music Rewind (the year, still or a 6-second clip)          */
/* ------------------------------------------------------------------ */

// The last screen of /rewind as a 9:16 card (Luca 2026-10-25). Same
// safe zones as the month card: SC_X margins both sides, nothing in
// the top-left corner, credit line under the heading, everything done
// by about y 515. As a clip the covers fade in one by one (calm, no
// flashes), then it holds; the still is simply the last frame.

export interface RewindCardData {
  handle: string;
  role?: string | null;
  /** Up to 9 covers, best first. */
  covers: (HTMLImageElement | null)[];
  /** Three [value, label] pairs, e.g. ["26", "records"]. */
  stats: [string, string][];
  /** "Top record: House Of Balloons · 10", or null. */
  topLine: string | null;
  labels: {
    eyebrow: string; // "PEAK MUSIC REWIND"
    heading: string; // "My 2026 on\nPeak Music"
  };
}

export const REWIND_CLIP = 6;

export function drawRewind(ctx: CanvasRenderingContext2D, a: CardAssets, d: RewindCardData, t = REWIND_CLIP) {
  ctx.fillStyle = "#050708";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.save();
  ctx.translate(180, 300);
  glowBlob(ctx, "191, 243, 255", 0, 0, 260, 0.07);
  ctx.restore();

  const L = SC_X;
  const R = SC_R;
  const W = R - L;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = font(a, 11, 600);
  ctx.fillStyle = "rgba(191,243,255,0.75)";
  ctx.fillText(d.labels.eyebrow, L, 72);
  ctx.font = font(a, 24, 800);
  ctx.fillStyle = "#fff";
  d.labels.heading.split("\n").forEach((line, i) => ctx.fillText(fit(ctx, line, W), L, 100 + i * 27));

  drawCredit(ctx, a, d.handle, L, 154, "left", W, d.role ?? null);

  // 3 × 3 covers, edge to edge (an empty slot = a dark sleeve).
  const cell = W / 3;
  const top = 176;
  for (let i = 0; i < 9; i++) {
    const k = easeOut((t - 0.15 - i * 0.12) / 0.5);
    if (k <= 0) continue;
    ctx.save();
    ctx.globalAlpha = k;
    drawCover(ctx, d.covers[i] ?? null, L + (i % 3) * cell, top + Math.floor(i / 3) * cell + (1 - k) * 4, cell, cell, 0);
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(191,243,255,0.18)";
  ctx.lineWidth = 0.75;
  ctx.strokeRect(L, top, W, W);

  // stats + the top record fade in once the grid is down
  const s = easeOut((t - 1.4) / 0.6);
  ctx.save();
  ctx.globalAlpha = s;
  let sx = L;
  const sy = top + W + 30;
  d.stats.forEach(([v, k]) => {
    ctx.font = font(a, 20, 700);
    ctx.fillStyle = "#fff";
    ctx.fillText(v, sx, sy);
    const vw = ctx.measureText(v).width;
    ctx.font = font(a, 11, 400);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(k, sx, sy + 15);
    sx += Math.max(vw, ctx.measureText(k).width) + 18;
  });
  if (d.topLine) {
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.fillRect(L, sy + 26, W, 0.5);
    ctx.font = font(a, 12, 500);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(fit(ctx, d.topLine, W), L, sy + 44);
  }
  ctx.restore();

  // faint scanlines: the CRT, quietly
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let y = 0; y < CARD_H; y += 3) ctx.fillRect(0, y, CARD_W, 1);
}
