import { isNetlifyDeployment } from "./deployment";
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
function originUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.origin === value
      ? url
      : null;
  } catch {
    return null;
  }
}
export function isLocalRequest(request: Request) {
  if (
    process.env.VERCEL ||
    isNetlifyDeployment() ||
    (process.env.NODE_ENV === "production" &&
      process.env.CATALOG_STORAGE !== "local")
  )
    return false;
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  try {
    return (
      loopbackHosts.has(url.hostname) &&
      loopbackHosts.has(new URL(url.protocol + "//" + host).hostname)
    );
  } catch {
    return false;
  }
}
export function trustedRequestOrigin(request: Request): string | null {
  const supplied = request.headers.get("origin");
  const origin = supplied ? originUrl(supplied) : null;
  if (!origin) return null;
  const allowed = new Set<string>();
  if (process.env.SITE_URL) {
    const site = originUrl(process.env.SITE_URL.trim().replace(/\/$/, ""));
    if (site) allowed.add(site.origin);
  }
  for (const value of (process.env.TRUSTED_PREVIEW_ORIGINS || "").split(",")) {
    const url = originUrl(value.trim());
    if (url?.protocol === "https:") allowed.add(url.origin);
  }
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview") {
    for (const host of [
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
    ]) {
      if (host && /^[a-z0-9.-]+$/i.test(host))
        allowed.add("https://" + host.toLowerCase());
    }
  }
  if (isNetlifyDeployment()) {
    const deployment = originUrl(process.env.NEUZ_NETLIFY_ORIGIN || "");
    if (deployment?.protocol === "https:") allowed.add(deployment.origin);
  }
  if (allowed.has(origin.origin)) return origin.origin;
  if (isLocalRequest(request)) {
    const url = new URL(request.url);
    if (
      loopbackHosts.has(origin.hostname) &&
      origin.protocol === url.protocol &&
      origin.port === url.port
    )
      return origin.origin;
  }
  return null;
}
