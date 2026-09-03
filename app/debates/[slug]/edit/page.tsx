import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDebateBySlug } from "@/lib/db/debates";
import { requireAuth } from "@/lib/auth";
import NewDebateForm from "@/components/debates/NewDebateForm";
import BackLink from "@/components/ui/BackLink";

export const metadata: Metadata = {
  title: "Edit debate",
  robots: { index: false, follow: false },
};

/**
 * /debates/[slug]/edit — rework a debate you opened (Luca 2026-09-02:
 * edit + delete from one place). Creator only: anyone else gets the
 * same 404 a missing slug gets, so the page never confirms a debate
 * exists to someone who can't edit it.
 */
export default async function EditDebatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, debate] = await Promise.all([requireAuth(), getDebateBySlug(slug)]);
  if (!debate || debate.created_by !== user.id) notFound();

  const sidesLocked = debate.votes.a + debate.votes.b > 0 || debate.message_count > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <BackLink
        fallback={`/debates/${debate.slug}`}
        label="Back"
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
      />
      <div className="space-y-1">
        <h1 className="crt-title text-2xl sm:text-3xl">Edit debate</h1>
        <p className="font-[family-name:var(--font-vt323)] text-lg text-text-secondary">
          {debate.is_published === false ? "Draft — only you can see it." : "Live — changes show at once."}
        </p>
      </div>
      <div className="panel-xbox p-5 sm:p-6">
        <NewDebateForm
          initial={{
            id: debate.id,
            slug: debate.slug,
            title: debate.title,
            prompt: debate.prompt,
            side_a_label: debate.side_a_label,
            side_b_label: debate.side_b_label,
            status: debate.status,
            release: debate.release,
            side_a_release: debate.side_a_release,
            side_b_release: debate.side_b_release,
            sidesLocked,
          }}
        />
      </div>
    </div>
  );
}
