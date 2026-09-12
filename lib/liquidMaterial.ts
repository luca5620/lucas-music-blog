/**
 * liquidMaterial — the flowing pigment-under-smoked-glass material
 * that replaced the drifting blurred circles (Astra's handoff,
 * 2026-09-11: "connected material with internal motion", not
 * separate glowing objects).
 *
 * Two halves live here, both framework-free so they can be reused
 * or unit-tested on their own:
 *
 *  1. The GLSL. One fragment shader draws the whole picture: a
 *     twice-warped noise field shaped into broad diagonal pigment
 *     bands, one oversized curved fold whose slope shades and
 *     refracts the pigment beneath it, an edge light along that
 *     fold, an occlusion pocket beside it, a calm mask that sinks
 *     whole regions to the base so the frame keeps negative space,
 *     and a hair of dither against banding. Time only ever moves
 *     forward — nothing loops, so there is no visible restart.
 *
 *  2. The palette. The site already carries three RGB triplets in
 *     --liquid-1/2/3 (defaults, profile-theme presets, and the
 *     cover-sampler push). Those three become six material roles
 *     (base, main, second, third, edge light, occlusion) via OKLab
 *     lightness/chroma shaping, so a navy sleeve gives navy
 *     currents with a paler navy edge light and a near-black navy
 *     floor — never an unrelated colour to "liven it up".
 */

export const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

export const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform vec2 u_size;
uniform float u_unit;
uniform float u_time;
uniform float u_seed;
uniform float u_intensity;
uniform vec3 u_base;
uniform vec3 u_main;
uniform vec3 u_second;
uniform vec3 u_third;
uniform vec3 u_edge;
uniform vec3 u_occl;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = m * p * 2.0 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

/* The fold: an oversized curved contour with its centre pushed off
   the frame, so only an open arc crosses the picture — never a
   complete sphere. Signed distance (negative = under the glass),
   roughened by slow noise so the arc is not a perfect circle.
   A page-tall canvas keeps going below the first screen, so two more
   folds wait further down (about 2.4 and 4.8 screens down, on
   alternating sides — Luca 2026-09-12: the modules area must not be
   a black void); a viewport-sized canvas never reaches them. */
float fold(vec2 p, float t) {
  vec2 c = vec2(0.95 + 0.06 * sin(t * 0.021), 0.42 + 0.05 * cos(t * 0.017));
  float d = length(p - c) - 0.92;
  d = min(d, length(p - vec2(-0.95 - 0.05 * cos(t * 0.019), -1.9 + 0.06 * sin(t * 0.015))) - 0.98);
  d = min(d, length(p - vec2(0.95 + 0.05 * sin(t * 0.016), -4.3 + 0.06 * cos(t * 0.02))) - 0.92);
  d += 0.16 * (fbm(p * 1.1 + vec2(t * 0.012, -t * 0.009) + u_seed) - 0.5);
  return d;
}

void main() {
  /* CSS pixels from the top-left, then composed at "one unit = the
     first viewport height" (u_unit): a viewport-sized canvas maps to
     x in [-aspect/2, aspect/2], y in [-0.5, 0.5] with +y up; a
     page-tall canvas shows that same first screen (the fold lives up
     top) and continues the currents and the calm void further down. */
  vec2 px = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_res * u_size;
  vec2 p = vec2(px.x - u_size.x * 0.5, u_unit * 0.5 - px.y) / u_unit;
  float t = u_time;

  /* fold height + slope (finite differences) */
  float e = 0.02;
  float d0 = fold(p, t);
  float dx = fold(p + vec2(e, 0.0), t) - fold(p - vec2(e, 0.0), t);
  float dy = fold(p + vec2(0.0, e), t) - fold(p - vec2(0.0, e), t);
  vec2 grad = vec2(dx, dy) / (2.0 * e);
  float inside = smoothstep(0.35, -0.35, d0);
  float rim = exp(-abs(d0 + 0.04) * 7.0);
  float occ = smoothstep(0.55, 0.0, d0) * (1.0 - inside);

  /* pigment currents: stretched + tilted so they run as long
     diagonal bands, warped twice so boundaries bend as time passes */
  mat2 tilt = mat2(0.94, 0.34, -0.34, 0.94);
  vec2 sp = (tilt * p) * vec2(0.42, 1.0);
  float k = mix(0.06, 0.22, fbm(sp * 0.5 + vec2(t * 0.006, -t * 0.004) + 21.0));
  vec2 refr = -grad * 0.22 * inside;
  vec2 q = vec2(
    fbm(sp * 0.9 + vec2(0.021 * t, -0.013 * t) + u_seed),
    fbm(sp * 0.9 + vec2(-0.017 * t, 0.019 * t) + u_seed + 7.3));
  vec2 r = vec2(
    fbm(sp * 1.4 + 1.8 * q + vec2(0.05 * t, 0.03 * t) + 3.1),
    fbm(sp * 1.4 + 1.8 * q + vec2(-0.04 * t, 0.045 * t) + 11.7));
  float f = fbm(sp * 0.8 + 1.7 * r + refr);
  float g = fbm(sp * 0.6 - 1.4 * r + refr * 0.5 + vec2(5.0, 2.0));

  /* calm mask: whole regions sink into the void so the picture keeps
     real negative space — true black for OLED, not colour everywhere
     (Luca 2026-09-11: "dark void-y aspects", "doesn't have to be all
     covered in the look") */
  float calm = smoothstep(0.33, 0.64, fbm(sp * 0.35 + vec2(t * 0.004, t * 0.003) + 40.0));
  float pig = calm;

  vec3 col = u_base;
  col = mix(col, u_main, smoothstep(0.50 - k, 0.50 + k, f) * 0.95 * pig);
  col = mix(col, u_second, smoothstep(0.62 - k, 0.62 + k, g) * 0.9 * pig);
  col = mix(col, u_second, smoothstep(0.70, 0.84, f) * 0.7 * pig);
  col = mix(col, u_occl, smoothstep(0.34, 0.14, f) * 0.55);
  col = mix(col, u_third, smoothstep(0.26 - k, 0.26 + k, g) * smoothstep(0.50, 0.36, f) * 0.5 * pig);

  /* shading from the fold's slope: one soft key light, top-left */
  vec3 n = normalize(vec3(-grad * 0.9, 1.0));
  float shade = dot(n, normalize(vec3(-0.5, 0.6, 0.7)));
  col *= 0.78 + 0.32 * shade;
  col = mix(col, col * 0.55, occ * 0.7);
  col = mix(col, col * 1.18 + u_edge * 0.10, inside * 0.5);
  col += u_edge * rim * 0.55;

  col = mix(vec3(0.0), col, u_intensity * mix(0.35, 1.0, calm));
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * (1.5 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ------------------------------------------------------------
   Palette
   ------------------------------------------------------------ */

export type RGB = [number, number, number];
/** sRGB 0..1 triplets in a fixed order: base, main, second, third,
    edge, occl — see ROLE_NAMES for the matching uniform names. */
export type Roles = RGB[];

export const ROLE_NAMES = [
  "u_base",
  "u_main",
  "u_second",
  "u_third",
  "u_edge",
  "u_occl",
] as const;

/** The site default trio (cobalt / icy pale blue / deep indigo) —
    mirrors :root --liquid-1/2/3 in globals.css, used when a var is
    missing. */
export const DEFAULT_TRIO: RGB[] = [
  [72 / 255, 142 / 255, 232 / 255],
  [140 / 255, 196 / 255, 244 / 255],
  [34 / 255, 58 / 255, 128 / 255],
];

const s2l = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const l2s = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function toOklab([r, g, b]: RGB): RGB {
  r = s2l(r);
  g = s2l(g);
  b = s2l(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function fromOklab([L, a, b]: RGB): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  // Gamut mapping by clamping in linear light, then encoding.
  return [
    clamp01(l2s(clamp01(r))),
    clamp01(l2s(clamp01(g))),
    clamp01(l2s(clamp01(bb))),
  ];
}

/** Scale a colour's OKLab lightness and chroma; gamut-clamped. */
function shape(rgb: RGB, L: number, C: number): RGB {
  const [l, a, b] = toOklab(rgb);
  return fromOklab([Math.min(0.98, Math.max(0.02, l * L)), a * C, b * C]);
}

/** Six material roles from the site's three-colour trio. A
    monochrome trio stays tonal — nothing here invents a hue. */
export function rolesFromTrio(trio: RGB[]): Roles {
  const c1 = trio[0] ?? DEFAULT_TRIO[0];
  const c2 = trio[1] ?? c1;
  const c3 = trio[2] ?? c2;
  return [
    shape(c1, 0.07, 0.2), // base: a whisper of tint over true black
    shape(c1, 0.62, 1.05), // main pigment
    shape(c2, 0.58, 1.05), // secondary pigment
    shape(c3, 0.5, 1.1), // third pigment (pockets)
    shape(c1, 0.92, 0.55), // edge light: paler, restrained relative
    shape(c3, 0.26, 0.9), // occlusion: the deep tinted shade
  ];
}

/** Interpolate two role sets in OKLab so a transition never passes
    through mud (a sage→plum swap goes via grey-violet, not brown). */
export function lerpRoles(a: Roles, b: Roles, k: number): Roles {
  return a.map((ca, i) => {
    const la = toOklab(ca);
    const lb = toOklab(b[i]);
    return fromOklab([
      la[0] + (lb[0] - la[0]) * k,
      la[1] + (lb[1] - la[1]) * k,
      la[2] + (lb[2] - la[2]) * k,
    ]);
  });
}

/** Parse "160, 224, 171" (the --liquid-* format) into sRGB 0..1. */
export function parseTriplet(value: string | null | undefined): RGB | null {
  if (!value) return null;
  const parts = value
    .split(",")
    .map((s) => Number.parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n));
  if (parts.length < 3) return null;
  return [clamp01(parts[0] / 255), clamp01(parts[1] / 255), clamp01(parts[2] / 255)];
}

/** Read the resolved --liquid-1/2/3 for an element (theme classes
    on ancestors and the <html> inline pushes both resolve here). */
export function readTrio(el: Element): RGB[] {
  const cs = getComputedStyle(el);
  const out: RGB[] = [];
  for (let i = 1; i <= 3; i++) {
    const c = parseTriplet(cs.getPropertyValue(`--liquid-${i}`));
    out.push(c ?? out[i - 2] ?? DEFAULT_TRIO[i - 1]);
  }
  return out;
}

/** Fired by the cover sampler and the profile-theme bridge right
    after they push new --liquid-* values, so fields can start their
    transition immediately instead of waiting for the next poll. */
export const LIQUID_CHANGE_EVENT = "pmr-liquid-change";
