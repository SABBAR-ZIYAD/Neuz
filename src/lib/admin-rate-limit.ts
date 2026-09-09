import { createHmac } from "node:crypto";
import {
  quoteClient,
  quoteLimitStore,
  type QuoteLimitStore,
} from "./quote-rate-limit";
import { CatalogError } from "./catalog-storage";
export class AdminRateLimitExceeded extends CatalogError {
  constructor(public retryAfter: number) {
    super(
      "Trop de tentatives depuis votre connexion. Réessayez plus tard.",
      429,
    );
  }
}
export async function limitAdmin(
  request: Request,
  action: "login" | "account",
  store: QuoteLimitStore = quoteLimitStore(),
) {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || secret.length < 32) throw Error("Missing admin secret");
    // Existing RPC accepts this historical key prefix. HMAC domain separation
    // keeps admin actions separate from quote traffic and from each other.
    const key =
      "quote:ip:" +
      createHmac("sha256", secret)
        .update("admin:" + action + ":" + quoteClient(request))
        .digest("hex");
    const result = await store.consume(
      key,
      action === "login" ? 20 : 5,
      15 * 60,
    );
    if (!result.allowed) throw new AdminRateLimitExceeded(result.retryAfter);
  } catch (error) {
    if (error instanceof AdminRateLimitExceeded) throw error;
    throw new CatalogError(
      "Protection de connexion indisponible. Réessayez plus tard.",
      503,
    );
  }
}
