import { getPublicCatalog } from "@/lib/catalog-data";
import { buildCatalogSitemap } from "@/lib/catalog-sitemap";
export default async function sitemap() {
  return buildCatalogSitemap((await getPublicCatalog()).categories);
}
