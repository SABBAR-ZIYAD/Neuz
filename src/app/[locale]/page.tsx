import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Landing } from "@/components/landing";
import { getPublicCatalog } from "@/lib/catalog-data";
import { localized } from "@/lib/catalog-model";
import { siteUrl } from "@/lib/seo";
import { organizationData, serializeJsonLd } from "@/lib/structured-data";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const catalog = await getPublicCatalog();
  const data = {
    "@context": "https://schema.org",
    ...organizationData(),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: t("services.navigation"),
      itemListElement: catalog.categories.map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name:
            localized(service, locale).title || localized(service, locale).name,
          url: siteUrl + "/" + locale + "/creations/" + service.slug,
        },
      })),
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
      />
      <Landing catalog={catalog} />
    </>
  );
}
