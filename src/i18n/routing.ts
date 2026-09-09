import { defineRouting } from "next-intl/routing";
export const routing = defineRouting({
  locales: ["fr", "en", "ar"],
  defaultLocale: "fr",
  localePrefix: "always",
  localeDetection: false,
  // HTML metadata and the sitemap own canonical language alternatives.
  alternateLinks: false,
});
export type Locale = (typeof routing.locales)[number];
