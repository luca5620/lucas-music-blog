"use client";

/**
 * LiquidField — one flowing pigment-under-glass field drawn by a
 * fragment shader on a decorative canvas (see lib/liquidMaterial.ts
 * for the material and the palette maths). This replaced every
 * string of drifting blurred circles (Astra's handoff 2026-09-11).
 *
 * Where it goes:
 *  - CRTShell's .crt-liquid (web screen) and .crt-bezel-liquid (the
 *    app's one field) — `sticky`, so a viewport-sized canvas rides
 *    along inside the page-tall wrapper instead of a page-tall canvas
 *  - the fixed .liquid-room beside the bezel on wide screens
 *  - LiquidAtmosphere's hero panels
 *
 * Colours: reads the resolved --liquid-1/2/3 from its parent every
 * 400ms (and instantly on the pmr-liquid-change event the cover
 * sampler and the profile-theme bridge fire), then glides to the new
 * six-role palette over 1.1s in OKLab without resetting the flow.
 *
 * Motion policy — the same thermal rules the old blobs obeyed:
 *  - prefers-reduced-motion or html.low-detail → a composed still
 *  - phone-width web → a still (the wash Luca approved holds still
 *    on phones; the field is one painted texture there, cheaper than
 *    the old blur stack)
 *  - the native app → moves only while html.motion-on (NativeMode:
 *    touch/scroll wakes it, 12s idle sleeps it)
 *  - desktop → 30fps, paused while the tab is hidden or the canvas
 *    is scrolled out of view
 * A still is exactly that: the clock only advances while motion is
 * allowed, so palette changes and resizes redraw the same pose.
 *
 * No WebGL (or a lost context) → `.liquid-fallback`, a static CSS
 * composition in the same palette. The old orbs never come back.
 */

import { useEffect, useRef, useState } from "react";
import {
  FRAG,
  VERT,
  ROLE_NAMES,
  LIQUID_CHANGE_EVENT,
  lerpRoles,
  readTrio,
  rolesFromTrio,
  type Roles,
} from "@/lib/liquidMaterial";

export type LiquidContext = "site" | "room" | "panel" | "page";

/* How much of the material shows (0 = black). Heroes are the richest
   expression; the site-wide wash stays calm behind content. */
const INTENSITY: Record<LiquidContext, number> = {
  site: 0.46,
  room: 0.4,
  panel: 0.7,
  page: 0.6,
};

const FPS = 30;
const TRANSITION_MS = 1100;
const POLL_MS = 400;
const MAX_PIXELS = 480_000;

function compile(gl: WebGLRenderingContext): WebGLProgram | null {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "LiquidField shader failed",
          gl.isContextLost() ? "(context lost)" : "",
          gl.getShaderInfoLog(s) || "(no log)"
        );
      }
      gl.deleteShader(s);
      return null;
    }
    return s;
  };
  const vs = make(gl.VERTEX_SHADER, VERT);
  const fs = make(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  return program;
}

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

export default function LiquidField({
  context,
  sticky = false,
  className = "",
}: {
  context: LiquidContext;
  /** Viewport-sized canvas that rides inside a page-tall wrapper. */
  sticky?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement ?? document.body;
    const root = document.documentElement;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      });
    } catch {
      gl = null;
    }
    if (!gl) {
      setFallback(true);
      return;
    }
    const program = compile(gl);
    if (!program) {
      setFallback(true);
      return;
    }
    gl.useProgram(program);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const a = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl!.getUniformLocation(program, name);
    const uRes = u("u_res");
    const uSize = u("u_size");
    const uTime = u("u_time");
    const roleLocs = ROLE_NAMES.map(u);
    gl.uniform1f(u("u_seed"), Math.random() * 100);
    gl.uniform1f(u("u_intensity"), INTENSITY[context]);

    /* --- palette --- */
    let trioKey = "";
    let current: Roles = rolesFromTrio(readTrio(parent));
    let from = current;
    let to = current;
    let transStart = -1;
    const upload = (roles: Roles) => {
      roles.forEach((c, i) => gl!.uniform3f(roleLocs[i], c[0], c[1], c[2]));
    };
    const readPalette = () => {
      const trio = readTrio(parent);
      const key = trio.map((c) => c.join(",")).join("|");
      if (key === trioKey) return;
      const first = trioKey === "";
      trioKey = key;
      if (first) {
        current = rolesFromTrio(trio);
        upload(current);
        return;
      }
      from = current;
      to = rolesFromTrio(trio);
      transStart = performance.now();
      schedule();
    };
    readPalette();

    /* --- motion policy --- */
    const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
    const mqPhone = matchMedia("(max-width: 768px)");
    const allowsMotion = () => {
      if (mqReduce.matches) return false;
      if (root.classList.contains("low-detail")) return false;
      if (root.classList.contains("native-app")) {
        return root.classList.contains("motion-on");
      }
      return !mqPhone.matches;
    };

    /* --- sizing --- */
    let needsFrame = true;
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      let scale = mqPhone.matches ? 0.4 : 0.5;
      const cap = Math.sqrt(MAX_PIXELS / (w * h));
      if (cap < scale) scale = cap;
      const bw = Math.max(1, Math.round(w * scale));
      const bh = Math.max(1, Math.round(h * scale));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl!.viewport(0, 0, bw, bh);
      gl!.uniform2f(uRes, bw, bh);
      gl!.uniform2f(uSize, w, h);
      needsFrame = true;
      schedule();
    };

    /* --- the loop --- */
    let raf = 0;
    let visible = true;
    let clock = 0; // only advances while motion is allowed
    let prevNow = performance.now();
    let lastDraw = 0;
    const frame = (now: number) => {
      raf = 0;
      if (document.hidden || !visible) return;
      const moving = allowsMotion();
      const transitioning = transStart >= 0;
      if (!moving && !transitioning && !needsFrame) return;
      if (now - lastDraw < 1000 / FPS - 1) {
        raf = requestAnimationFrame(frame);
        return;
      }
      if (moving) clock += Math.min(0.1, (now - prevNow) / 1000);
      prevNow = now;
      lastDraw = now;
      needsFrame = false;
      if (transitioning) {
        const k = Math.min(1, (now - transStart) / TRANSITION_MS);
        current = lerpRoles(from, to, easeOut(k));
        upload(current);
        if (k >= 1) {
          transStart = -1;
          current = to;
        }
      }
      gl!.uniform1f(uTime, clock);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      if (moving || transStart >= 0) raf = requestAnimationFrame(frame);
    };
    function schedule() {
      if (raf || document.hidden || !visible) return;
      prevNow = performance.now();
      raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      schedule();
    });
    io.observe(canvas);

    const mo = new MutationObserver(schedule);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });

    const onVisibility = () => schedule();
    document.addEventListener("visibilitychange", onVisibility);
    mqReduce.addEventListener("change", schedule);
    mqPhone.addEventListener("change", resize);
    window.addEventListener(LIQUID_CHANGE_EVENT, readPalette);
    const poll = setInterval(readPalette, POLL_MS);

    const onLost = (e: Event) => {
      e.preventDefault();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      setFallback(true);
    };
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      clearInterval(poll);
      window.removeEventListener(LIQUID_CHANGE_EVENT, readPalette);
      mqReduce.removeEventListener("change", schedule);
      mqPhone.removeEventListener("change", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
      gl!.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [context]);

  const cls = `liquid-field ${sticky ? "liquid-field-sticky" : ""} ${className}`;
  if (fallback) {
    return <div className={`liquid-fallback ${cls}`} aria-hidden="true" />;
  }
  return <canvas ref={ref} className={cls} aria-hidden="true" />;
}
