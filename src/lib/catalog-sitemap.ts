import type { MetadataRoute } from "next";
import { siteUrl, languageAlternates } from "./seo";
import { routing } from "@/i18n/routing";
export function buildCatalogSitemap(
  categories: ReadonlyArray<{ slug: string }>,
): MetadataRoute.Sitemap {
  return [
    "",
    "/privacy",
    ...categories.map((category) => "/creations/" + category.slug),
  ].flatMap((path) =>
    routing.locales.map((locale) => ({
      url: siteUrl + "/" + locale + path,
      alternates: { languages: languageAlternates(path) },
    })),
  );
}
