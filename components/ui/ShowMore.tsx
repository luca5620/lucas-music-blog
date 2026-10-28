"use client";

/**
 * ShowMore — a <ul> that renders its first `batch` children and hides
 * the rest behind a "Show more (N left)" button, adding another batch
 * per tap. The children can be server-rendered rows: this component
 * only decides how many of them to show.
 *
 * Used where a list can grow long but the page isn't paginated
 * (My Stuff reviews, 2026-10-27).
 */

import { Children, useState } from "react";
import { useTranslations } from "next-intl";

export default function ShowMore({
  children,
  batch = 24,
  className,
}: {
  children: React.ReactNode;
  batch?: number;
  className?: string;
}) {
  const t = useTranslations("common");
  const [shown, setShown] = useState(batch);
  const items = Children.toArray(children);
  const left = items.length - shown;

  return (
    <>
      <ul className={className}>{items.slice(0, shown)}</ul>
      {left > 0 && (
        <div className="flex justify-center pt-3">
          <button
            type="button"
            onClick={() => setShown((n) => n + batch)}
            className="btn-y2k btn-y2k-outline"
          >
            {t("showMore", { n: left })}
          </button>
        </div>
      )}
    </>
  );
}
