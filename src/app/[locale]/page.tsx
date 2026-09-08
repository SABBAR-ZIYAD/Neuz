import { setRequestLocale } from "next-intl/server";
import { Landing } from "@/components/landing";
import { contact } from "@/lib/catalog";
import { siteUrl } from "@/lib/seo";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "NEUZ",
    url: siteUrl,
    logo: `${siteUrl}/images/neuz-logo.png`,
    email: contact.email,
    telephone: contact.phone,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Marrakech",
      addressCountry: "MA",
    },
    sameAs: [contact.instagram],
    knowsLanguage: ["fr", "en", "ar"],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Créations artistiques sur mesure",
      itemListElement: [
        "Tapis",
        "Miroirs",
        "Œuvres murales",
        "Tables artistiques",
        "Sculptures",
        "Tableaux",
        "Poufs",
        "Coussins",
      ].map((name) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name },
      })),
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(data).replace(/</g, "\\u003c"),
        }}
      />
      <Landing />
    </>
  );
}
