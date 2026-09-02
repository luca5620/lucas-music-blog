"use client";

/**
 * NavigationPending — the instant tap feedback, without the soft 404s.
 *
 * This replaces `app/loading.tsx`. That file did one job well (a tap
 * produced something on screen immediately instead of nothing, which
 * was the worst mobile feel-issue we ever had) and one job badly: a
 * loading boundary makes Next commit the HTTP response — status 200 —
 * before the page has rendered, so every notFound() on the site became
 * a soft 404 and the dead-review 308 never fired. See app/not-found.tsx.
 *
 * Same feedback, moved to the client. It wraps the CRT's content slot,
 * exactly where loading.tsx used to render, so the header, footer and
 * tab bar stay put and only the page area swaps — visually identical to
 * what it replaces. Because nothing is a streaming boundary any more,
 * Next holds the response until the page renders and 404s come out as
 * real 404s.
 *
 * What it deliberately does NOT cover: back/forward, and router.push()
 * from code. Both used to show the loading state. Neither goes through
 * a click, and both are usually served from Next's client cache — the
 * trade was worth real status codes.
 */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Blank content can't outlive a navigation that silently died. */
const FAILSAFE_MS = 8000;

export default function NavigationPending({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  // Clear the moment the new route commits. This is React's documented
  // "adjust state during render" pattern rather than an effect: an
  // effect would run after paint, so the finished page would flash the
  // TUNING panel for one frame before appearing.
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    if (pending) setPending(false);
  }

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // NO defaultPrevented check — that was the bug that killed this
      // component dead on arrival (Luca 2026-09-02: "we removed the
      // tuning thing in general"). Next's <Link> calls preventDefault()
      // on EVERY client-side navigation before pushing, so by the time
      // this bubble listener runs, every internal link click looks
      // "handled" and the panel never showed once, web or app. A click
      // that was hijacked to do something non-navigational instead is
      // almost always a same-path link (sheet openers, toggles), which
      // the pathname guard below already skips — and the rare miss is
      // cleaned up by the pathname-commit clear + the 8s failsafe.
      // Left button, unmodified — anything else opens a new tab.
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || !anchor.getAttribute("href")) return;
      if (anchor.hasAttribute("download")) return;

      const targetAttr = anchor.getAttribute("target");
      if (targetAttr && targetAttr !== "_self") return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // Off-site links leave the app entirely — nothing to wait for.
      if (url.origin !== window.location.origin) return;
      // Query- and hash-only changes (search filters, the view toggle,
      // anchors) keep the same pathname, and the pathname change is
      // what clears the panel — showing it here would strand it until
      // the failsafe fired. They're client-side and instant anyway.
      if (url.pathname === window.location.pathname) return;

      setPending(true);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!pending) return;
    // A navigation that never lands (cancelled, offline, a link that
    // turned out to do nothing) must not leave the page blank forever.
    const timer = setTimeout(() => setPending(false), FAILSAFE_MS);
    // Back/forward during a pending navigation abandons it.
    const onPopState = () => setPending(false);
    window.addEventListener("popstate", onPopState);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("popstate", onPopState);
    };
  }, [pending]);

  if (pending) return <Tuning />;

  return <>{children}</>;
}

/**
 * The channel-change static, lifted unchanged from the old
 * app/loading.tsx so the feel is identical: three bars sweeping out of
 * phase under a TUNING readout.
 */
function Tuning() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 py-32"
      role="status"
      aria-label="Loading"
    >
      <div className="flex items-end gap-1.5 h-8" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-1.5 rounded-sm bg-accent-primary/70 animate-pulse"
            style={{
              height: `${[60, 100, 40, 80, 55][i]}%`,
              animationDelay: `${i * 120}ms`,
              animationDuration: "0.9s",
            }}
          />
        ))}
      </div>
      <p className="osd-text text-sm tracking-widest opacity-70">TUNING…</p>
    </div>
  );
}
