/**
 * Share cards — turning the canvas into a file and handing it off.
 *
 * VIDEO: the scorecard is recorded straight off the canvas with
 * MediaRecorder while it plays (canvas.captureStream), so making the
 * video takes as long as the video itself (~16s). The sheet shows the
 * card playing while it records, which doubles as the preview. iOS
 * Safari records MP4; desktop Chrome records MP4 when it can, WebM
 * otherwise.
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

/** True when this device can make the scorecard video. */
export function canRecordVideo(): boolean {
  if (typeof document === "undefined") return false;
  const c = document.createElement("canvas") as HTMLCanvasElement & { captureStream?: unknown };
  return typeof c.captureStream === "function" && pickVideoMime() !== null;
}

/**
 * Record `duration` seconds of the canvas. `frame(t)` is called every
 * animation frame to draw time t; `onProgress(0–1)` drives the bar.
 */
export function recordCanvas(
  canvas: HTMLCanvasElement,
  frame: (t: number) => void,
  duration: number,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const mime = pickVideoMime();
  if (!mime) return Promise.reject(new Error("no-recorder"));
  const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(30);
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
