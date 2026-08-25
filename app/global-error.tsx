"use client";

/**
 * Root-level crash screen. If the whole app shell throws (an error
 * that even layout.tsx can't survive), Next.js renders THIS instead —
 * so it must bring its own <html>/<body> and can't rely on globals.css
 * being alive, hence the inline styles. Styled as the CRT losing the
 * picture, same language as the offline overlay.
 *
 * Also the last line of defense for error REPORTING: normal component
 * errors reach Sentry via instrumentation, but root-layout crashes
 * only get reported if we capture them here ourselves.
 */
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#000",
          color: "#e8e6e3",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
        }}
      >
        <p
          style={{
            fontSize: "2rem",
            letterSpacing: "0.15em",
            color: "#1e90ff",
            textShadow:
              "0 0 8px rgba(30,144,255,0.8), 0 0 24px rgba(30,144,255,0.35)",
          }}
        >
          SIGNAL LOST
        </p>
        <p style={{ maxWidth: "24rem", fontSize: "0.9rem", color: "#9a9a9e" }}>
          Peak Music Reviews hit a wall. It&apos;s been reported — try
          tuning back in.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "0.5rem",
            padding: "0.6rem 1.5rem",
            background: "transparent",
            color: "#1e90ff",
            border: "1px solid rgba(30,144,255,0.4)",
            borderRadius: "4px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Retry
        </button>
      </body>
    </html>
  );
}
