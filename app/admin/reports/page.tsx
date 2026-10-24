import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import {
  getOpenReports,
  getHandledReportCount,
  getReportedProfiles,
  type ReportTargetType,
  type ReportedProfile,
} from "@/lib/db/moderation";
import ReportActions from "./ReportActions";

/**
 * /admin/reports — the moderation queue. Staff-only (same gate as
 * /admin/import). Lists open content reports newest-first with
 * Resolve / Dismiss / Delete-content actions.
 */

export const metadata: Metadata = {
  title: "Report Queue — Admin",
  robots: { index: false, follow: false },
};

// The queue must always show live data.
export const dynamic = "force-dynamic";

/** Which target types the queue can hard-delete from. Mirrors the
    DELETABLE map in the admin API route. */
const DELETABLE_TYPES: ReportTargetType[] = [
  "review",
  "comment",
  "debate_message",
  "room_message",
  "list",
  "post",
  "aux_message",
  "aux_room",
];

/** Human label + (where possible) a link to look at the target. */
function targetLabel(type: ReportTargetType): string {
  switch (type) {
    case "review": return "Review";
    case "comment": return "Comment";
    case "list": return "List";
    case "debate": return "Debate";
    case "debate_message": return "Debate message";
    case "room_message": return "Room message";
    case "profile": return "Profile";
    case "post": return "Post";
    case "aux_room": return "Aux War room";
    case "aux_message": return "Aux War message";
  }
}

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as Pick<Profile, "role"> | null)?.role;

  if (role !== "owner" && role !== "admin") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="panel-xbox-glow p-8">
          <span className="label-xbox mb-4 inline-flex">Access Denied</span>
          <h1 className="pixel-text text-2xl font-bold mb-3">
            This area is staff-only.
          </h1>
          <p className="text-sm opacity-70">
            The moderation queue is reserved for site staff.
          </p>
        </div>
      </main>
    );
  }

  const [reports, handledCount] = await Promise.all([
    getOpenReports(100),
    getHandledReportCount(),
  ]);

  // Profile reports show the member's picture + banner right in the
  // queue, so staff can judge them and take either one down without
  // leaving the page (Apple 1.2, tightened 2026-10-16).
  const reportedProfiles = await getReportedProfiles([
    ...new Set(
      reports.filter((r) => r.target_type === "profile").map((r) => r.target_id)
    ),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <div className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">REPORT QUEUE</h1>
        <p className="text-text-secondary text-sm">
          Open reports, newest first. Resolve = handled, Dismiss = bogus
          report, Delete content = remove the reported thing and resolve.
          On a profile report, Remove avatar / Remove banner delete that
          image (the report stays open — resolve it when you&apos;re done).
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="panel-xbox p-10 text-center space-y-2">
          <p className="osd-text text-sm">QUEUE CLEAR</p>
          <p className="text-sm text-text-muted">
            Nothing open. Either the community is behaving or nobody found
            the flag button yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="panel-xbox p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="label-xbox">{targetLabel(r.target_type)}</span>
                    <span className="text-xs text-text-muted">
                      {new Date(r.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {r.reporter && (
                      <span className="text-xs text-text-muted">
                        by{" "}
                        <Link
                          href={`/profile/${r.reporter.username}`}
                          className="text-accent-primary hover:underline"
                        >
                          @{r.reporter.username}
                        </Link>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary break-words">
                    {r.reason}
                  </p>
                  <p className="text-[11px] text-text-muted font-mono break-all">
                    target: {r.target_id}
                  </p>
                  {r.target_type === "profile" && (
                    <ReportedProfilePreview profile={reportedProfiles.get(r.target_id)} />
                  )}
                </div>

                <ReportActions
                  reportId={r.id}
                  deletable={DELETABLE_TYPES.includes(r.target_type)}
                  profileImages={
                    r.target_type === "profile"
                      ? {
                          avatar: !!reportedProfiles.get(r.target_id)?.avatar_url,
                          banner: !!reportedProfiles.get(r.target_id)?.banner_url,
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-text-muted">
        {handledCount} report{handledCount === 1 ? "" : "s"} previously handled.
      </p>
    </main>
  );
}

/** The reported member's link + current picture and banner. Plain
    <img> on purpose: next/image would keep a cached copy on Vercel,
    and a removed image must actually be gone. */
function ReportedProfilePreview({ profile }: { profile: ReportedProfile | undefined }) {
  if (!profile) {
    return <p className="text-xs text-text-muted">Profile no longer exists.</p>;
  }
  return (
    <div className="space-y-2 pt-1">
      <Link
        href={`/profile/${profile.username}`}
        className="text-xs text-accent-primary hover:underline"
      >
        @{profile.username}
      </Link>
      <div className="flex items-end gap-3">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt="Reported avatar"
            className="w-14 h-14 rounded-full object-cover border border-border-medium"
          />
        ) : (
          <span className="text-[11px] text-text-muted">no avatar</span>
        )}
        {profile.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.banner_url}
            alt="Reported banner"
            className="h-14 w-40 rounded object-cover border border-border-medium"
          />
        ) : (
          <span className="text-[11px] text-text-muted">no banner</span>
        )}
      </div>
    </div>
  );
}
