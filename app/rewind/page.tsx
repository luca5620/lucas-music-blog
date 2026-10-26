import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { getRewind, rewindYear } from "@/lib/rewind";
import RewindStory from "@/components/rewind/RewindStory";

/**
 * /rewind — Peak Music Rewind, your year in review (2026-10-25).
 *
 * Open December 1 → January 15 (lib/rewind.ts). Outside that window
 * this is a short "opens December 1" screen, except for the Founder,
 * admins and Early Testers, who see their real year early (with a
 * small "preview" note) so it can be checked on real accounts.
 *
 * Always YOUR year — signed out goes to log in and comes back here.
 * The numbers are worked out on the server; the tap-through story is
 * components/rewind/RewindStory.tsx.
 */

export const metadata: Metadata = {
  title: "Peak Music Rewind",
  description: "Your year on Peak Music: every record you rated, your top 10, your Song of the Day run.",
  alternates: { canonical: "https://peakmusicreviews.com/rewind" },
  robots: { index: false },
};

// Per-person and date-dependent: never cache.
export const dynamic = "force-dynamic";

export default async function RewindPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/rewind");

  const t = await getTranslations("rewind");
  const role = (profile.role as string | null) ?? null;
  const year = rewindYear(new Date(), role);
  // Open to everyone only inside the window; a preview role gets a
  // year outside it too.
  const preview = year !== null && rewindYear(new Date()) === null;

  if (year === null) {
    return (
      <Notice title={t("closedTitle")} body={t("closedBody")} cta={{ href: "/reviews/new", label: t("closedCta") }} />
    );
  }

  const data = await getRewind(
    {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      role,
      avatar_url: profile.avatar_url,
    },
    year
  );

  if (data.total < 3) {
    return (
      <Notice
        title={t("emptyTitle")}
        body={t("emptyBody", { year })}
        cta={{ href: "/reviews/new", label: t("emptyCta") }}
      />
    );
  }

  return (
    <div className="px-4 py-6 sm:py-10">
      <RewindStory data={data} preview={preview} />
    </div>
  );
}

function Notice({ title, body, cta }: { title: string; body: string; cta: { href: string; label: string } }) {
  return (
    <div className="px-4 py-16 sm:py-24 flex justify-center">
      <div className="rw-notice">
        <span className="rw-eyebrow">Peak Music Rewind</span>
        <h1>{title}</h1>
        <p>{body}</p>
        <Link href={cta.href} className="btn-y2k btn-y2k-outline">
          {cta.label}
        </Link>
      </div>
    </div>
  );
}
