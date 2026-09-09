import { isNetlifyDeployment } from "./deployment";
import { isLocalRequest, trustedRequestOrigin } from "./request-origin";
import { CatalogError } from "./catalog-storage";
export function turnstileRequired(request: Request) {
  return (
    Boolean(process.env.VERCEL) ||
    isNetlifyDeployment() ||
    !isLocalRequest(request)
  );
}
export async function verifyTurnstile(
  request: Request,
  token: string | undefined,
  action: "quote" | "admin_login",
) {
  const site = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const required = turnstileRequired(request);
  if (!site && !secret && !required) return;
  if (
    !site ||
    !secret ||
    (required && (/^[123]x0{8}/.test(site) || /^[123]x0{8}/.test(secret)))
  )
    throw new CatalogError(
      "La vérification de sécurité n’est pas configurée.",
      503,
    );
  if (!token || token.length > 2048)
    throw new CatalogError(
      "Veuillez effectuer la vérification de sécurité.",
      400,
    );
  const origin = trustedRequestOrigin(request);
  if (!origin) throw new CatalogError("Origine non autorisée.", 403);
  let result;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) throw Error("Verification unavailable");
    result = await response.json();
  } catch {
    throw new CatalogError(
      "La vérification de sécurité est indisponible. Réessayez.",
      503,
    );
  }
  if (
    result?.success !== true ||
    result.hostname !== new URL(origin).hostname ||
    result.action !== action
  )
    throw new CatalogError(
      "La vérification de sécurité a expiré ou échoué. Réessayez.",
      400,
    );
}
