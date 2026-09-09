import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // These two public deployment facts are compiled into the app. Never add secrets here.
  env: {
    NEUZ_NETLIFY_CONTEXT:
      process.env.NETLIFY === "true" ? process.env.CONTEXT || "unknown" : "",
    NEUZ_NETLIFY_ORIGIN:
      process.env.NETLIFY === "true" ? process.env.DEPLOY_PRIME_URL || "" : "",
  },
  outputFileTracingExcludes: { "/*": ["./data/**/*", "./tmp/**/*", "./.env*"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default createNextIntlPlugin("./src/i18n/request.ts")(config);
