import { isPreviewDeployment } from "./deployment";
import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";

const configuredUrl = process.env.SITE_URL?.trim();
const origin = new URL(configuredUrl || "http://localhost:3000");
export const siteUrl = origin.origin;
export const isPublicSite = Boolean(
  configuredUrl &&
  origin.protocol === "https:" &&
  !isPreviewDeployment() &&
  process.env.SITE_NOINDEX !== "true",
);

export function languageAlternates(path = "") {
  return Object.fromEntries([
    ...routing.locales.map((locale) => [locale, siteUrl + "/" + locale + path]),
    ["x-default", siteUrl + "/fr" + path],
  ]);
}

export function pageMetadata(
  locale: Locale,
  title: string,
  description: string,
  path = "",
  image = "/images/og-neuz.jpg",
): Metadata {
  const url = siteUrl + "/" + locale + path;
  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    robots: { index: isPublicSite, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: "NEUZ",
      type: "website",
      locale: { fr: "fr_MA", en: "en_GB", ar: "ar_MA" }[locale],
      images: [
        {
          url: image.startsWith("https://") ? image : siteUrl + image,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.startsWith("https://") ? image : siteUrl + image],
    },
  };
}
