"use client";

import Link from "next/link";
import { useWebOnly } from "@/lib/useWebOnly";

/**
 * The footer's "Support Peak Music" link — WEBSITE ONLY (2026-10-25).
 * Renders nothing on the server, then only outside the app shell: the
 * app must never point anyone at a way to pay outside Apple
 * (3.1.1 / 3.1.3). The label comes from the server footer so this
 * stays a tiny client island.
 */
export default function SupportFooterLink({ label }: { label: string }) {
  if (!useWebOnly()) return null;
  return (
    <>
      {" · "}
      <Link
        href="/support"
        className="text-text-secondary hover:text-accent-primary transition-colors"
      >
        {label}
      </Link>
    </>
  );
}
