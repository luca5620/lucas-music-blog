/**
 * Share cards — the site's own liquid behind the scorecard (Luca
 * 2026-10-28: "more lighting … more like the actual website background
 * for the music").
 *
 * The scorecard used to fake the background with four drifting radial
 * glows. This draws the REAL material instead — the same fragment
 * shader as the site (lib/liquidMaterial.ts: pigment currents, the
 * curved fold with its edge light, the calm dark pockets), fed the same
 * cover trio the release page pushes into --liquid-1/2/3 — on one small
 * offscreen WebGL canvas, then copied into the 2D card each frame.
 *
 * One renderer for the whole session (a phone only allows a handful of
 * WebGL contexts). No WebGL, or a lost context → returns false and the
 * card falls back to the old glows, so a card is always made.
 */

import { FRAG, VERT, ROLE_NAMES, rolesFromTrio, parseTriplet, DEFAULT_TRIO, type RGB } from "@/lib/liquidMaterial";

/* Rendered at 1.5× card units (540×960) and scaled up: the material
   is soft, so this is sharp enough at 1080×1920 and cheap per frame. */
const RES = 1.5;
/* Brighter than the site's phone wash (0.42): the card IS the hero,
   and a story needs the light to carry on a small screen. */
const INTENSITY = 0.9;
/* Start a little into the flow so the first frame already has its
   currents bent, and keep the site's own (calm) speed after that. */
const T0 = 24;
const SEED = 17.3;

interface Renderer {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  uTime: WebGLUniformLocation | null;
  roles: (WebGLUniformLocation | null)[];
  w: number;
  h: number;
  key: string;
}

let renderer: Renderer | null = null;
let broken = false;

function create(w: number, h: number): Renderer | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * RES);
  canvas.height = Math.round(h * RES);
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      // drawImage() reads it after the draw call
      preserveDrawingBuffer: true,
    });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const make = (type: number, src: string) => {
    const s = gl!.createShader(type);
    if (!s) return null;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    return gl!.getShaderParameter(s, gl!.COMPILE_STATUS) ? s : null;
  };
  const vs = make(gl.VERTEX_SHADER, VERT);
  const fs = make(gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const u = (name: string) => gl!.getUniformLocation(program, name);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(u("u_res"), canvas.width, canvas.height);
  // composed like a phone screen: one unit = the card's height
  gl.uniform2f(u("u_size"), w, h);
  gl.uniform1f(u("u_unit"), h);
  gl.uniform1f(u("u_seed"), SEED);
  gl.uniform1f(u("u_intensity"), INTENSITY);
  canvas.addEventListener("webglcontextlost", () => {
    renderer = null;
    broken = true;
  });
  return { canvas, gl, uTime: u("u_time"), roles: ROLE_NAMES.map(u), w, h, key: "" };
}

/**
 * Paint the site's liquid over (0, 0, w, h) of a pre-scaled card ctx
 * at time t (seconds). false = couldn't (caller draws its fallback).
 */
export function drawSiteLiquid(ctx: CanvasRenderingContext2D, palette: string[], t: number, w: number, h: number): boolean {
  if (broken || typeof document === "undefined") return false;
  if (!renderer || renderer.w !== w || renderer.h !== h) {
    renderer = create(w, h);
    if (!renderer) {
      broken = true;
      return false;
    }
  }
  const r = renderer;
  const key = palette.slice(0, 3).join("|");
  if (key !== r.key) {
    r.key = key;
    const trio: RGB[] = [0, 1, 2].map((i) => parseTriplet(palette[i]) ?? parseTriplet(palette[0]) ?? DEFAULT_TRIO[i]);
    rolesFromTrio(trio).forEach((c, i) => r.gl.uniform3f(r.roles[i], c[0], c[1], c[2]));
  }
  r.gl.uniform1f(r.uTime, T0 + t);
  r.gl.drawArrays(r.gl.TRIANGLES, 0, 3);
  ctx.drawImage(r.canvas, 0, 0, w, h);
  return true;
}
