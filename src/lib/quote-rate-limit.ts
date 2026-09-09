import { isNetlifyDeployment } from "./deployment";
import { isLocalRequest } from "./request-origin";
import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { mkdir, readFile, rename, rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dataDirectory, storageMode, supabase } from "./catalog-storage";
export type LimitResult = { allowed: boolean; retryAfter: number };
export interface QuoteLimitStore {
  consume(key: string, limit: number, seconds: number): Promise<LimitResult>;
}
export const quoteLimits = {
  ip: { limit: 5, seconds: 15 * 60 },
  email: { limit: 5, seconds: 60 * 60 },
} as const;
export class QuoteLimitExceeded extends Error {
  constructor(public retryAfter: number) {
    super("Quote limit reached");
  }
}
export function normalizeClientIp(value: string) {
  const ip = value.trim();
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6 || ip.includes("%")) throw Error("Invalid client IP");
  const canonical = new URL("http://[" + ip + "]/").hostname.slice(1, -1);
  const sides = canonical.split("::");
  const left = sides[0] ? sides[0].split(":") : [];
  const right = sides[1] ? sides[1].split(":") : [];
  const parts =
    sides.length === 2
      ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
      : left;
  const words = parts.map((value) => parseInt(value, 16));
  if (words.slice(0, 5).every((value) => value === 0) && words[5] === 65535)
    return [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join(
      ".",
    );
  // Group IPv6 privacy addresses on one /64 network to prevent suffix rotation.
  return (
    words
      .slice(0, 4)
      .map((value) => value.toString(16))
      .join(":") + "::/64"
  );
}
export function quoteClient(request: Request) {
  if (process.env.VERCEL === "1") {
    const ip = request.headers.get("x-vercel-forwarded-for");
    if (!ip || ip.includes(",")) throw Error("Trusted client IP unavailable");
    return normalizeClientIp(ip);
  }
  if (isNetlifyDeployment()) {
    const ip = request.headers.get("x-nf-client-connection-ip");
    if (!ip || ip.includes(",")) throw Error("Trusted client IP unavailable");
    return normalizeClientIp(ip);
  }
  const trustedHeader = (
    process.env.TRUSTED_CLIENT_IP_HEADER || process.env.QUOTE_TRUSTED_IP_HEADER
  )?.trim();
  if (trustedHeader) {
    const ip = request.headers.get(trustedHeader);
    if (!ip || ip.includes(",")) throw Error("Trusted client IP unavailable");
    return normalizeClientIp(ip);
  }
  if (isLocalRequest(request)) return "local-preview";
  throw Error("Configure a trusted proxy IP header for this host");
}
export function quoteLimitKey(scope: "ip" | "email", identifier: string) {
  const secret =
    process.env.QUOTE_RATE_LIMIT_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw Error("Quote rate-limit secret is missing");
  const normalized =
    scope === "email" ? identifier.trim().toLowerCase() : identifier;
  return (
    "quote:" +
    scope +
    ":" +
    createHmac("sha256", secret)
      .update(scope + ":" + normalized)
      .digest("hex")
  );
}
type Bucket = { count: number; expires: number };
export class LocalQuoteLimitStore implements QuoteLimitStore {
  constructor(
    private directory = join(dataDirectory(), "quote-limits"),
    private now = Date.now,
  ) {}
  async consume(
    key: string,
    limit: number,
    seconds: number,
  ): Promise<LimitResult> {
    await mkdir(this.directory, { recursive: true });
    const lock = join(this.directory, "write.lock");
    // A crashed local writer fails closed; never steal a potentially active lock.
    let acquired = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        await mkdir(lock);
        acquired = true;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    if (!acquired) throw Error("Quote limit store busy");
    try {
      const file = join(this.directory, "buckets.json");
      const buckets: Record<string, Bucket> = await readFile(file, "utf8")
        .then(JSON.parse)
        .catch((error) => {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
          throw error;
        });
      const now = this.now();
      for (const [id, bucket] of Object.entries(buckets))
        if (bucket.expires <= now) delete buckets[id];
      if (!buckets[key] && Object.keys(buckets).length >= 10000)
        throw Error("Local quote limit capacity reached");
      const bucket = buckets[key] || {
        count: 0,
        expires: now + seconds * 1000,
      };
      const allowed = bucket.count < limit;
      bucket.count = Math.min(bucket.count + 1, limit + 1);
      buckets[key] = bucket;
      const temporary = join(this.directory, randomUUID() + ".tmp");
      await writeFile(temporary, JSON.stringify(buckets), { mode: 0o600 });
      await rename(temporary, file);
      return {
        allowed,
        retryAfter: allowed
          ? 0
          : Math.max(1, Math.ceil((bucket.expires - now) / 1000)),
      };
    } finally {
      await rmdir(lock);
    }
  }
}
export class SupabaseQuoteLimitStore implements QuoteLimitStore {
  async consume(
    key: string,
    limit: number,
    seconds: number,
  ): Promise<LimitResult> {
    const { data, error } = await supabase().rpc("neuz_consume_quote_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: seconds,
    });
    const result = data?.[0];
    if (
      error ||
      typeof result?.allowed !== "boolean" ||
      !Number.isInteger(result?.retry_after) ||
      result.retry_after < 0
    )
      throw Error("Quote limit storage unavailable");
    return { allowed: result.allowed, retryAfter: result.retry_after };
  }
}
export function quoteLimitStore(): QuoteLimitStore {
  return storageMode() === "supabase"
    ? new SupabaseQuoteLimitStore()
    : new LocalQuoteLimitStore();
}
export async function limitQuote(
  scope: "ip" | "email",
  identifier: string,
  store: QuoteLimitStore = quoteLimitStore(),
) {
  const policy = quoteLimits[scope];
  const result = await store.consume(
    quoteLimitKey(scope, identifier),
    policy.limit,
    policy.seconds,
  );
  if (!result.allowed) throw new QuoteLimitExceeded(result.retryAfter);
}
