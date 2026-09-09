import { trustedRequestOrigin } from "@/lib/request-origin";
import { verifyTurnstile } from "@/lib/turnstile";
import { CatalogError } from "@/lib/catalog-storage";
import {
  reserveQuoteEmail,
  QuoteEmailQuotaExceeded,
} from "@/lib/quote-email-quota";
import { createHash } from "node:crypto";
import { Resend } from "resend";
import {
  limitQuote,
  quoteClient,
  QuoteLimitExceeded,
} from "@/lib/quote-rate-limit";
import {
  quoteSchema,
  fileTypes,
  MAX_FILE_BYTES,
  MAX_FILES,
  safeFilename,
  validFileSignature,
} from "@/lib/quote";
import { quoteEmail } from "@/lib/email";
import { contact } from "@/lib/catalog";
export const runtime = "nodejs";
const MAX_BODY = MAX_FILE_BYTES + 128 * 1024;
function response(code: string, status: number) {
  return Response.json(
    { code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
function limitError(error: unknown) {
  if (error instanceof QuoteEmailQuotaExceeded)
    return Response.json(
      { code: "QUOTA_LIMIT", retryAfter: error.retryAfter },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(error.retryAfter),
        },
      },
    );
  if (error instanceof QuoteLimitExceeded)
    return Response.json(
      { code: "RATE_LIMIT", retryAfter: error.retryAfter },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(error.retryAfter),
        },
      },
    );
  return response("FAILED", 503);
}
async function boundedFormData(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  let total = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY) {
      await reader.cancel();
      throw new Error("size");
    }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": request.headers.get("content-type") || "" },
  }).formData();
}
export async function POST(request: Request) {
  if (!trustedRequestOrigin(request)) return response("FORBIDDEN", 403);
  if (
    !request.headers.get("content-type")?.startsWith("multipart/form-data") ||
    Number(request.headers.get("content-length") || 0) > MAX_BODY
  )
    return response("INVALID", 400);
  try {
    await limitQuote("ip", quoteClient(request));
  } catch (error) {
    return limitError(error);
  }
  let form: FormData;
  try {
    form = await boundedFormData(request);
  } catch {
    return response("INVALID", 400);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data")));
  } catch {
    return response("INVALID", 400);
  }
  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success) return response("INVALID", 400);
  const data = parsed.data;
  if (data.website) return response("INVALID", 400);
  const uploads = form.getAll("files");
  if (
    uploads.length > MAX_FILES ||
    uploads.some((file) => !(file instanceof File))
  )
    return response("INVALID", 400);
  const files = uploads as File[];
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_FILE_BYTES)
    return response("INVALID", 400);
  const attachments = [];
  for (const file of files) {
    if (!file.size || !fileTypes.includes(file.type))
      return response("INVALID", 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!validFileSignature(bytes, file.type)) return response("INVALID", 400);
    attachments.push({
      filename: safeFilename(file.name),
      content: bytes,
      contentType: file.type,
    });
  }
  try {
    await verifyTurnstile(request, data.turnstile, "quote");
  } catch (error) {
    return response(
      error instanceof CatalogError && error.status === 400
        ? "INVALID"
        : "UNAVAILABLE",
      error instanceof CatalogError ? error.status : 503,
    );
  }
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_FROM ||
    /@(?:gmail|googlemail)\.com[>\s]*$/i.test(process.env.RESEND_FROM)
  )
    return response("UNAVAILABLE", 503);
  try {
    await limitQuote("email", data.email);
  } catch (error) {
    return limitError(error);
  }
  const reference = `NZ-${data.requestId.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const email = quoteEmail(
    data,
    reference,
    attachments.map((f) => f.filename),
  );
  const fingerprint = createHash("sha256").update(
    JSON.stringify({ ...data, turnstile: undefined }),
  );
  attachments.forEach((a) => fingerprint.update(a.content));
  // Reserve before sending; keep the reservation even if delivery is uncertain.
  try {
    await reserveQuoteEmail();
  } catch (error) {
    return limitError(error);
  }
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send(
      {
        from: process.env.RESEND_FROM,
        to: [contact.email],
        replyTo: data.email,
        ...email,
        attachments,
      },
      {
        idempotencyKey: `quote-${data.requestId}-${fingerprint.digest("hex").slice(0, 20)}`,
      },
    );
    if (
      error &&
      ["daily_quota_exceeded", "monthly_quota_exceeded"].includes(error.name)
    )
      return response("QUOTA_LIMIT", 429);
    if (error?.name === "rate_limit_exceeded")
      return response("RATE_LIMIT", 429);
    if (error) return response("FAILED", 502);
    return Response.json(
      { reference },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return response("FAILED", 502);
  }
}
