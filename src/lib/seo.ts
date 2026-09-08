export const siteUrl = (
  process.env.SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");
export const isPublicSite = Boolean(
  process.env.SITE_URL && /^https:\/\//.test(process.env.SITE_URL),
);
