/**
 * Share cards — turning the canvas into a file and handing it off.
 *
 * VIDEO (rebuilt 2026-10-25, Luca: "choppy and laggy"): every frame
 * is drawn on its own and handed to the phone's hardware H.264 encoder
 * (WebCodecs, through the Mediabunny library), then packed into an MP4.
 * That makes a true 60fps file with no dropped frames, even when the
 * phone is too slow to draw in real time. It used to be filmed live off
 * the screen with MediaRecorder at 30fps, so any frame the phone drew
 * late simply went missing. That live way is still the fallback for
 * browsers without WebCodecs (iOS before 16.4).
 *
 * Frames are never drawn faster than real time, so the card in the
 * sheet still plays at normal speed while the video is made, and that
 * doubles as the preview.
 *
 * HANDING IT OFF, in order:
 *   1. In the app with the Filesystem plugin (build 1.3+): write the
 *      file to the app's cache and open the native share sheet with it
 *      (Instagram, Photos, Messages…). See nativeShareFile in lib/native.
 *   2. Browsers that can share files (iOS Safari, Android Chrome):
 *      navigator.share({ files }).
 *   3. Desktop (no touch screen): download the file.
 *   4. Older app builds (no Filesystem plugin) can't save a file at all:
 *      "unsupported" — the sheet then shows the image to press-and-hold
 *      (stills), or explains it needs the app update (videos).
 */

import { isNativeApp, nativeShareFile } from "@/lib/native";

export type HandOff = "shared" | "saved" | "cancelled" | "unsupported";

/** The best video format this browser can record, or null. */
export function pickVideoMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const options = [
    "video/mp4;codecs=avc1.42E01F",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/** True when this device can make the scorecard video (either way). */
export function canRecordVideo(): boolean {
  if (typeof document === "undefined") return false;
  if (typeof VideoEncoder !== "undefined") return true;
  const c = document.createElement("canvas") as HTMLCanvasElement & { captureStream?: unknown };
  return typeof c.captureStream === "function" && pickVideoMime() !== null;
}

/** Frames per second of the finished video. */
const FPS = 60;

/** Wait for the next screen refresh (lets the sheet repaint). */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Make `duration` seconds of video from the canvas. `frame(t)` draws
 * time t; `onProgress(0–1)` drives the bar. Frame-by-frame MP4 when the
 * device can encode H.264 at this size, the live recording otherwise.
 */
export async function recordCanvas(
  canvas: HTMLCanvasElement,
  frame: (t: number) => void,
  duration: number,
  onProgress?: (p: number) => void
): Promise<Blob> {
  if (typeof VideoEncoder !== "undefined") {
    const video = await encodeFrames(canvas, frame, duration, onProgress).catch(() => null);
    if (video) return video;
  }
  return recordLive(canvas, frame, duration, onProgress);
}

/** The frame-by-frame way. null when this device can't encode it. */
async function encodeFrames(
  canvas: HTMLCanvasElement,
  frame: (t: number) => void,
  duration: number,
  onProgress?: (p: number) => void
): Promise<Blob | null> {
  // Loaded only when someone actually makes a video.
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality, canEncodeVideo } = await import("mediabunny");
  if (!(await canEncodeVideo("avc", { width: canvas.width, height: canvas.height }))) return null;

  const output = new Output({
    // "in-memory" puts the index at the front, so the file starts
    // playing straight away in Photos / Instagram / TikTok.
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, { codec: "avc", quality: new Quality("high") });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  // +1 so the very last pose (t = duration) is in the file.
  const total = Math.round(duration * FPS) + 1;
  const start = performance.now();
  let lastPaint = start;
  try {
    for (let i = 0; i < total; i++) {
      const t = i / FPS;
      // Ahead of the clock: wait, so the preview plays at normal speed.
      while (t * 1000 > performance.now() - start) await nextFrame();
      // Behind the clock: keep going without waiting, but still let the
      // screen repaint now and then so the progress bar moves.
      if (performance.now() - lastPaint > 50) {
        await nextFrame();
        lastPaint = performance.now();
      }
      frame(Math.min(t, duration));
      // Each frame gets its exact time stamp, so the file is a steady
      // 60fps no matter how long this frame took to draw.
      await source.add(t, 1 / FPS);
      onProgress?.(i / (total - 1));
    }
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }
  const buffer = output.target.buffer;
  return buffer ? new Blob([buffer], { type: "video/mp4" }) : null;
}

/** The old live recording, for browsers without WebCodecs. */
function recordLive(
  canvas: HTMLCanvasElement,
  frame: (t: number) => void,
  duration: number,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const mime = pickVideoMime();
  if (!mime) return Promise.reject(new Error("no-recorder"));
  const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  return new Promise((resolve, reject) => {
    let raf = 0;
    recorder.onerror = () => {
      cancelAnimationFrame(raf);
      reject(new Error("record-failed"));
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop());
      resolve(new Blob(chunks, { type: mime.split(";")[0] }));
    };
    frame(0);
    recorder.start(250);
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      frame(Math.min(t, duration));
      onProgress?.(Math.min(t / duration, 1));
      if (t >= duration) {
        // one more frame's worth so the last pose is in the file
        window.setTimeout(() => recorder.state !== "inactive" && recorder.stop(), 120);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png-failed"))), "image/png")
  );
}

/** File extension for a blob's type. */
export function extFor(blob: Blob) {
  if (blob.type.includes("mp4")) return "mp4";
  if (blob.type.includes("webm")) return "webm";
  return "png";
}

/** Share the file the best way this device allows (see the list up top). */
export async function shareOrSave(blob: Blob, filename: string, title: string): Promise<HandOff> {
  if (isNativeApp()) {
    const native = await nativeShareFile(blob, filename, title);
    if (native !== "unavailable") return native;
  }
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  // Phones/tablets only: desktop Chrome has a share dialog too, but on a
  // computer people expect the file in their downloads.
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  if (touch && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // fall through to a download
    }
  }
  if (isNativeApp()) return "unsupported";
  saveFile(blob, filename);
  return "saved";
}

/** Plain download (desktop browsers). */
export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
