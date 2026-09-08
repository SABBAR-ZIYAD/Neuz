import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["fr", "en", "ar"].map((locale) => ({
    url: `${siteUrl}/${locale}`,
    alternates: {
      languages: {
        fr: `${siteUrl}/fr`,
        en: `${siteUrl}/en`,
        ar: `${siteUrl}/ar`,
      },
    },
  }));
}
