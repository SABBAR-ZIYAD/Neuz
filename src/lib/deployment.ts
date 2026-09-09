// Only nonsecret deployment metadata is compiled by next.config.ts.
// Netlify's build variables are not guaranteed to exist in Functions at runtime.
export function isNetlifyDeployment() {
  return Boolean(process.env.NEUZ_NETLIFY_CONTEXT);
}

export function isPreviewDeployment() {
  return (
    process.env.VERCEL_ENV === "preview" ||
    (isNetlifyDeployment() && process.env.NEUZ_NETLIFY_CONTEXT !== "production")
  );
}
