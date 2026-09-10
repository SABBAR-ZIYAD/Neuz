import type { MetadataRoute } from "next";
import { siteUrl, isPublicSite } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: isPublicSite ? "/" : undefined,
      disallow: isPublicSite ? ["/api/", "/abdel", "/abdel/"] : "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
