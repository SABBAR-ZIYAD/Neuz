import { createHash } from "node:crypto";
import { Resend } from "resend";
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
const attempts = new Map<string, { count: number; until: number }>();
const MAX_BODY = MAX_FILE_BYTES + 128 * 1024;
function response(code: string, status: number) {
  return Response.json(
    { code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
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
  const origin = request.headers.get("origin");
  const expected = process.env.SITE_URL
    ? new URL(process.env.SITE_URL).origin
    : new URL(request.url).origin;
  if (!origin || origin !== expected) return response("FORBIDDEN", 403);
  if (
    !request.headers.get("content-type")?.startsWith("multipart/form-data") ||
    Number(request.headers.get("content-length") || 0) > MAX_BODY
  )
    return response("INVALID", 400);
  // Short-lived, hashed keys: no raw client identifiers or request data are logged.
  const ip =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "local";
  const key = createHash("sha256").update(ip).digest("hex");
  const now = Date.now();
  for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const current = attempts.get(key) || {
    count: 0,
    until: now + 15 * 60 * 1000,
  };
  if (current.count >= 5) return response("RATE_LIMIT", 429);
  if (attempts.size >= 10000 && !attempts.has(key))
    return response("RATE_LIMIT", 429);
  current.count++;
  attempts.set(key, current);
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
  if (process.env.TURNSTILE_SECRET_KEY) {
    if (!data.turnstile) return response("INVALID", 400);
    try {
      const check = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: new URLSearchParams({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: data.turnstile,
          }),
          signal: AbortSignal.timeout(8000),
        },
      );
      const result = await check.json();
      if (!result.success || result.hostname !== new URL(expected).hostname)
        return response("INVALID", 400);
    } catch {
      return response("FAILED", 502);
    }
  }
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_FROM ||
    /@(?:gmail|googlemail)\.com[>\s]*$/i.test(process.env.RESEND_FROM)
  )
    return response("UNAVAILABLE", 503);
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
    if (error) return response("FAILED", 502);
    return Response.json(
      { reference },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return response("FAILED", 502);
  }
}
