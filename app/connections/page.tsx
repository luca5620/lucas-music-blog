import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getFollowers, getFollowing } from "@/lib/db/profiles";
import type { ConnectionProfile } from "@/lib/db/profiles";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import PageHero from "@/components/ui/PageHero";
import type { Metadata } from "next";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Connections",
  robots: { index: false, follow: false },
};

// Always fresh — follows change constantly during testing.
export const dynamic = "force-dynamic";

/**
 * /connections — YOUR followers and who YOU follow.
 *
 * Privacy by design: this page only ever shows the signed-in user's
 * own lists (reached by tapping your own follower/following counts).
 * Other people's connection lists aren't browsable anywhere.
 */
export default async function ConnectionsPage() {
  const user = await requireAuth();
  const t = await getTranslations("connections");

  const [followers, following] = await Promise.all([
    getFollowers(user.id),
    getFollowing(user.id),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Page header — boxed hero, same as HOME */}
      <PageHero title={t("title")} sub={t("sub")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <ConnectionColumn
          title={t("followers", { n: followers.length })}
          people={followers}
          empty={t("noFollowers")}
        />
        <ConnectionColumn
          title={t("following", { n: following.length })}
          people={following}
          empty={t("noFollowing")}
        />
      </div>
    </div>
  );
}

function ConnectionColumn({
  title,
  people,
  empty,
}: {
  title: string;
  people: ConnectionProfile[];
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="label-xbox">{title}</h2>
      <div className="panel-xbox divide-y divide-border-subtle">
        {people.length === 0 ? (
          <p className="p-4 text-sm text-text-muted">{empty}</p>
        ) : (
          people.map((p) => (
            <Link
              key={p.username}
              href={`/profile/${p.username}`}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg-elevated transition-colors"
            >
              <span className="w-9 h-9 rounded-full overflow-hidden bg-accent-primary/20 border border-border-subtle shrink-0 flex items-center justify-center">
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-accent-primary uppercase">
                    {p.username.charAt(0)}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-bold text-text-primary truncate">
                  {p.display_name || p.username}
                  {p.role !== "user" && <VerifiedBadge role={p.role} />}
                </span>
                <span className="block text-xs text-text-secondary truncate">
                  @{p.username}
                </span>
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
