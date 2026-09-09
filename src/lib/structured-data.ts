import { contact } from "@/lib/catalog";
import { siteUrl } from "@/lib/seo";
export function organizationData() {
  return {
    "@type": "Organization",
    "@id": siteUrl + "/#organization",
    name: "NEUZ",
    url: siteUrl + "/fr",
    logo: siteUrl + "/images/neuz-logo.png",
    email: contact.email,
    telephone: contact.phone,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Marrakech",
      addressCountry: "MA",
    },
    sameAs: [contact.instagram],
    knowsLanguage: ["fr", "en", "ar"],
  };
}
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
