"use client";

/**
 * MonthShareButton — "Share my month" beside Customize on your own
 * profile. Opens MonthShareSheet, which only downloads on tap.
 * On phones it shrinks to a ↗ (see .month-share-label in globals.css).
 */

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { hapticTap } from "@/lib/native";

const MonthShareSheet = dynamic(() => import("@/components/share/MonthShareSheet"), { ssr: false });

export default function MonthShareButton({
  userId,
  handle,
  role = null,
  avatarUrl,
  accentColor,
}: {
  userId: string;
  handle: string;
  /** profiles.role, for the checkmark after the @ on the card */
  role?: string | null;
  avatarUrl: string | null;
  accentColor: string;
}) {
  const t = useTranslations("shareCards");
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        className="btn-y2k btn-y2k-outline month-share-btn"
        aria-label={t("monthButton")}
        style={{ borderColor: accentColor, color: accentColor }}
        onClick={() => {
          hapticTap();
          setOpen(true);
        }}
      >
        {/* Phones: just ↗ (the avatar and this row share ~250px);
            the words come back from 640px up. */}
        <span aria-hidden="true">↗</span>
        <span className="month-share-label">{t("monthButton")}</span>
      </button>
      {open && <MonthShareSheet userId={userId} handle={handle} role={role} avatarUrl={avatarUrl} onClose={close} />}
    </>
  );
}
