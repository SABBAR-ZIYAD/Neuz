import { AdminRateLimitExceeded } from "./admin-rate-limit";
import { trustedRequestOrigin } from "./request-origin";
import type { NextRequest } from "next/server";
import { adminCookie, validSession } from "./admin-auth";
import { CatalogError } from "./catalog-storage";
export function checkOrigin(request: Request) {
  if (!trustedRequestOrigin(request))
    throw new CatalogError(
      "Cette requ\u00EAte n\u2019est pas autoris\u00E9e.",
      403,
    );
}
export function requireAdmin(request: NextRequest) {
  if (!validSession(request.cookies.get(adminCookie)?.value))
    throw new CatalogError(
      "Votre session a expir\u00E9. Reconnectez-vous.",
      401,
    );
  if (request.method !== "GET") checkOrigin(request);
}
export async function readBody(request: Request, maximum: number) {
  if (Number(request.headers.get("content-length")) > maximum)
    throw new CatalogError(
      "Le fichier ou la requ\u00EAte est trop volumineux.",
      413,
    );
  const reader = request.body?.getReader();
  if (!reader) throw new CatalogError("La requ\u00EAte est vide.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximum) {
      await reader.cancel();
      throw new CatalogError(
        "Le fichier ou la requ\u00EAte est trop volumineux.",
        413,
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function readJson(request: Request, maximum = 128 * 1024) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new CatalogError("Format de requ\u00EAte incorrect.", 415);
  try {
    return JSON.parse((await readBody(request, maximum)).toString("utf8"));
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    throw new CatalogError("Donn\u00E9es invalides.");
  }
}
export function adminError(error: unknown) {
  if (error instanceof AdminRateLimitExceeded)
    return Response.json(
      { error: error.message, retryAfter: error.retryAfter },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(error.retryAfter),
        },
      },
    );
  if (error instanceof CatalogError)
    return Response.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  console.error(
    "Admin request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return Response.json(
    {
      error:
        "Une erreur est survenue. Vos modifications n\u2019ont pas \u00E9t\u00E9 confirm\u00E9es.",
    },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
