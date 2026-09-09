import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { contact } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { ContentShell } from "@/components/content-shell";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale });
  return pageMetadata(
    locale,
    t("footer.privacy") + " | NEUZ",
    t("services.privacyDescription"),
    "/privacy",
  );
}
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <ContentShell locale={locale} path="/privacy">
      <main id="main" className="privacy-page">
        <h1>{t("privacy.title")}</h1>
        <p>{t("privacy.text")}</p>
        <p>{t("privacy.rights", { email: contact.email })}</p>
        <a className="text-link" href={"mailto:" + contact.email} dir="ltr">
          {contact.email}
        </a>
      </main>
    </ContentShell>
  );
}
