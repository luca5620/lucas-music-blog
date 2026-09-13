import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import NewRoomForm from "@/components/aux-battles/NewRoomForm";
import BackLink from "@/components/ui/BackLink";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Host an Aux Battle",
};

/** /aux-battles/new — host a room (signed-in only; middleware also guards). */
export default async function NewAuxBattlePage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/aux-battles/new");
  const t = await getTranslations("aux.new");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <BackLink
        fallback="/aux-battles"
        label={t("back")}
        className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
      />
      <div className="space-y-1">
        <h1 className="crt-title text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="text-sm text-text-secondary">{t("sub")}</p>
      </div>
      <div className="panel-xbox p-4 sm:p-6">
        <NewRoomForm />
      </div>
    </div>
  );
}
