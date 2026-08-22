"use client";

/**
 * BackLink — "← Back" that returns to wherever the viewer actually
 * came from (Your Taste, a feed, a profile) instead of always the
 * section index. Luca 2026-08-22: Taste → review → "back" dumped
 * him in /reviews, losing his place in the pager — and the same bug
 * lived on every detail page.
 *
 * Heuristic: pop real history when it exists and the tab wasn't
 * entered from another site (external referrer + same-tab means
 * back would LEAVE the site); otherwise fall through to the plain
 * fallback link — direct loads, new tabs, and search visits land
 * on the section index exactly as before.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function BackLink({
  fallback,
  label,
  className,
}: {
  /** The section index to use when there's no in-site history. */
  fallback: string;
  /** Text after the arrow, e.g. "Back to Reviews". */
  label: string;
  className?: string;
}) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    // Modified clicks (new tab, etc.) keep native link behavior.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const cameFromOutside =
      document.referrer && !document.referrer.startsWith(window.location.origin);
    if (window.history.length > 1 && !cameFromOutside) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <Link href={fallback} onClick={handleClick} className={className}>
      ← {label}
    </Link>
  );
}
