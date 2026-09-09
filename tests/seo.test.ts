import { describe, expect, test } from "bun:test";
import { buildCatalogSitemap } from "../src/lib/catalog-sitemap";
import { languageAlternates, pageMetadata, siteUrl } from "../src/lib/seo";
import { serializeJsonLd } from "../src/lib/structured-data";
import { services } from "../src/lib/services";

describe("search discovery", () => {
  test("every sitemap entry is unique and belongs to its reciprocal language set", () => {
    const entries = buildCatalogSitemap(services);
    expect(entries).toHaveLength(15);
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(15);
    for (const entry of entries) {
      const languages = entry.alternates!.languages!;
      expect(Object.values(languages)).toContain(entry.url);
      for (const url of Object.values(languages))
        expect(entries.some((candidate) => candidate.url === url)).toBe(true);
    }
  });
  test("service metadata points to the service in each language, including x-default", () => {
    for (const service of services) {
      const path = "/creations/" + service.slug;
      const metadata = pageMetadata("ar", "Title", "Description", path);
      expect(metadata.alternates?.canonical).toBe(siteUrl + "/ar" + path);
      expect(metadata.alternates?.languages).toEqual(languageAlternates(path));
      expect(languageAlternates(path)["x-default"]).toBe(
        siteUrl + "/fr" + path,
      );
      expect(metadata.openGraph).toMatchObject({ url: siteUrl + "/ar" + path });
    }
  });
  test("JSON-LD cannot terminate its script element and preserves the original data", () => {
    const value = { name: "</script><script>alert(1)</script>" };
    const encoded = serializeJsonLd(value);
    expect(encoded).not.toContain("<");
    expect(JSON.parse(encoded)).toEqual(value);
  });
});
