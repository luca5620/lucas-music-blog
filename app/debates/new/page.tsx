import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import NewDebateForm from "@/components/debates/NewDebateForm";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Open a debate",
};

/**
 * /debates/new — open a debate.
 * Middleware already gates this route; requireAuth is the
 * second layer (defense in depth, same as the other + pages).
 */
export default async function NewDebatePage() {
  await requireAuth();
  const t = await getTranslations("debates.new");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <section className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="text-sm text-text-secondary">
          {t("sub")}
        </p>
      </section>

      <section className="panel-xbox p-4 sm:p-6 relative overflow-hidden">
        <NewDebateForm />
        <div className="scan-bar" />
      </section>
    </div>
  );
}
