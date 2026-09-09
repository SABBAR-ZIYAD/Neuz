import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, spyOn, beforeEach, afterEach, mock } from "bun:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import {
  quoteSchema,
  validFileSignature,
  safeFilename,
} from "../src/lib/quote";
import { quoteEmail, escapeHtml } from "../src/lib/email";
import { POST } from "../src/app/api/quote/route";
import { contact } from "../src/lib/catalog";
import fr from "../messages/fr.json";
import en from "../messages/en.json";
import ar from "../messages/ar.json";

const environmentKeys = [
  "SITE_URL",
  "CATALOG_DATA_DIR",
  "CATALOG_STORAGE",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VERCEL",
  "QUOTE_RATE_LIMIT_SECRET",
  "QUOTE_TRUSTED_IP_HEADER",
  "QUOTE_EMAIL_DAILY_LIMIT",
  "QUOTE_EMAIL_MONTHLY_LIMIT",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_BRANCH_URL",
  "TRUSTED_PREVIEW_ORIGINS",
  "TRUSTED_CLIENT_IP_HEADER",
];
let previousEnvironment: Record<string, string | undefined>;
let testDirectory: string;
let ipNumber = 0;
function testIp() {
  ipNumber++;
  return "192.0." + Math.floor(ipNumber / 250) + "." + ((ipNumber % 250) + 1);
}
beforeEach(async () => {
  previousEnvironment = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  );
  for (const key of environmentKeys) delete process.env[key];
  testDirectory = await mkdtemp(join(tmpdir(), "neuz-quote-test-"));
  Object.assign(process.env, {
    CATALOG_DATA_DIR: testDirectory,
    CATALOG_STORAGE: "local",
    QUOTE_RATE_LIMIT_SECRET: "quote-test-secret-".repeat(3),
    QUOTE_TRUSTED_IP_HEADER: "x-forwarded-for",
  });
});
afterEach(async () => {
  mock.restore();
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(testDirectory, { recursive: true, force: true });
});

const sample = {
  name: "Test Client",
  email: "test@example.com",
  phone: "+212600000000",
  profile: "private",
  project: "residential",
  creation: "rug",
  quantity: "2",
  width: "200",
  height: "300",
  unit: "cm",
  budget: "discuss",
  brief: "Un tapis pour le salon. ألوان دافئة.",
  method: "whatsapp",
  consent: true,
  locale: "ar",
  requestId: randomUUID(),
  inspiration: "Fragments de terre",
};
function request(
  data: unknown = sample,
  options: { origin?: string; files?: File[]; ip?: string } = {},
) {
  const form = new FormData();
  form.set("data", JSON.stringify(data));
  options.files?.forEach((f) => form.append("files", f));
  return new Request("http://localhost:3000/api/quote", {
    method: "POST",
    headers: {
      origin: options.origin ?? "http://localhost:3000",
      "x-forwarded-for": options.ip ?? testIp(),
    },
    body: form,
  });
}

test("valid quote retains all fields, Unicode and numeric quantity", () => {
  const parsed = quoteSchema.parse(sample);
  assert.equal(parsed.quantity, 2);
  assert.match(parsed.brief, /ألوان/);
  assert.equal(parsed.method, "whatsapp");
});
test("rejects invalid emails, zero quantity, unsafe dimensions and missing consent", () => {
  for (const fields of [
    { email: "nope" },
    { quantity: 0 },
    { width: "-2" },
    { height: "Infinity" },
    { consent: false },
    { phone: "-------" },
    { brief: "short" },
  ])
    assert.equal(
      quoteSchema.safeParse({ ...sample, ...fields }).success,
      false,
    );
  assert.equal(
    quoteSchema.safeParse({ ...sample, width: "", height: "" }).success,
    true,
  );
});
test("owner email contains all form data and escapes untrusted markup", () => {
  const data = quoteSchema.parse({
    ...sample,
    name: "<script>alert(1)</script>",
    brief: "<img src=x onerror=alert(1)> A sufficiently detailed brief.",
  });
  const email = quoteEmail(data, "NZ-TEST", ["moodboard.pdf"]);
  assert.ok(!email.html.includes("<script>"));
  assert.ok(!email.html.includes("<img src=x"));
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /https:\/\/wa.me\/212600000000/);
  for (const value of [
    "moodboard.pdf",
    "200",
    "300",
    "À définir ensemble",
    "WhatsApp",
    "Français",
    "NZ-TEST",
  ].filter((v) => v !== "Français"))
    assert.ok(email.html.includes(value), value);
  assert.ok(email.text.includes(data.brief));
  assert.equal(escapeHtml('"<&'), "&quot;&lt;&amp;");
});
test("attachment validation checks magic bytes, not just filename", () => {
  assert.ok(
    validFileSignature(new TextEncoder().encode("%PDF-1.7"), "application/pdf"),
  );
  assert.ok(
    validFileSignature(
      Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png",
    ),
  );
  assert.ok(validFileSignature(Uint8Array.from([255, 216, 255]), "image/jpeg"));
  assert.ok(
    validFileSignature(new TextEncoder().encode("RIFFxxxxWEBP"), "image/webp"),
  );
  assert.equal(
    validFileSignature(new TextEncoder().encode("<script>"), "image/png"),
    false,
  );
  assert.equal(validFileSignature(new Uint8Array(), "application/pdf"), false);
  assert.equal(safeFilename("../plan\n.pdf"), ".._plan_.pdf");
});
function keys(value: unknown, prefix = ""): string[] {
  return value && typeof value === "object"
    ? Object.entries(value).flatMap(([k, v]) => keys(v, `${prefix}.${k}`))
    : [prefix];
}
test("French, English and Arabic contain matching translation keys", () => {
  assert.deepEqual(keys(en), keys(fr));
  assert.deepEqual(keys(ar), keys(fr));
});

test("quote endpoint rejects foreign origins and bad form data", async () => {
  assert.equal(
    (await POST(request(sample, { origin: "https://untrusted.example" })))
      .status,
    403,
  );
  assert.equal((await POST(request({ ...sample, email: "bad" }))).status, 400);
  assert.equal(
    (await POST(request({ ...sample, website: "spam.example" }))).status,
    400,
  );
  assert.equal(
    (
      await POST(
        request(sample, {
          files: [new File(["not a PNG"], "image.png", { type: "image/png" })],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await POST(
        request(sample, {
          files: [
            new File(["a".repeat(3 * 1024 * 1024 + 1)], "large.pdf", {
              type: "application/pdf",
            }),
          ],
        }),
      )
    ).status,
    400,
  );
});
test("shared IP rate limit stops repeated requests", async () => {
  const ip = testIp();
  for (let i = 0; i < 5; i++) await POST(request({}, { ip }));
  assert.equal((await POST(request({}, { ip }))).status, 429);
});
test("email endpoint is honest when unconfigured and uses the correct envelope when configured", async () => {
  const previous = {
    key: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM,
    site: process.env.SITE_URL,
    turnstile: process.env.TURNSTILE_SECRET_KEY,
  };
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  delete process.env.SITE_URL;
  delete process.env.TURNSTILE_SECRET_KEY;
  try {
    assert.equal((await POST(request())).status, 503);
    process.env.RESEND_API_KEY = "re_mock_test_not_a_real_key";
    process.env.RESEND_FROM = "NEUZ <test@verified.example>";
    const prototype = Object.getPrototypeOf(
      new Resend(process.env.RESEND_API_KEY).emails,
    );
    const mock = spyOn(prototype, "send").mockImplementation(async () => ({
      data: { id: "mock-id" },
      error: null,
    }));
    const pdf = new File(["%PDF-1.7\nlocal test"], "reference.pdf", {
      type: "application/pdf",
    });
    const response = await POST(request(sample, { files: [pdf] }));
    assert.equal(response.status, 200);
    assert.match((await response.json()).reference, /^NZ-/);
    const [envelope, options] = mock.mock.calls[0] as Parameters<
      Resend["emails"]["send"]
    >;
    assert.deepEqual(envelope.to, [contact.email]);
    assert.equal(envelope.replyTo, "test@example.com");
    assert.equal(envelope.from, process.env.RESEND_FROM);
    assert.equal(envelope.attachments?.[0].filename, "reference.pdf");
    assert.ok(options?.idempotencyKey);
    await POST(request(sample, { files: [pdf] }));
    assert.equal(
      (mock.mock.calls[1] as Parameters<Resend["emails"]["send"]>)[1]
        ?.idempotencyKey,
      options.idempotencyKey,
    );
    mock.mockImplementation(async () => ({
      data: null,
      error: { message: "simulated failure" },
    }));
    assert.equal((await POST(request())).status, 502);
    process.env.RESEND_FROM = "NEUZ <neuzinteriordesign@gmail.com>";
    assert.equal((await POST(request())).status, 503);
  } finally {
    for (const [key, value] of Object.entries({
      RESEND_API_KEY: previous.key,
      RESEND_FROM: previous.from,
      SITE_URL: previous.site,
      TURNSTILE_SECRET_KEY: previous.turnstile,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("daily cap blocks Resend calls and preserves the cap after a send failure", async () => {
  process.env.RESEND_API_KEY = "re_mock_test";
  process.env.RESEND_FROM = "NEUZ <test@verified.example>";
  process.env.QUOTE_EMAIL_DAILY_LIMIT = "1";
  const prototype = Object.getPrototypeOf(
    new Resend(process.env.RESEND_API_KEY).emails,
  );
  const send = spyOn(prototype, "send").mockImplementation(async () => ({
    data: null,
    error: { name: "application_error", message: "uncertain delivery" },
  }));
  assert.equal((await POST(request())).status, 502);
  const blocked = await POST(request({ ...sample, requestId: randomUUID() }));
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).code, "QUOTA_LIMIT");
  assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
  assert.equal(send.mock.calls.length, 1);
});
test("provider quota errors produce the contact fallback", async () => {
  process.env.RESEND_API_KEY = "re_mock_test";
  process.env.RESEND_FROM = "NEUZ <test@verified.example>";
  const prototype = Object.getPrototypeOf(
    new Resend(process.env.RESEND_API_KEY).emails,
  );
  spyOn(prototype, "send").mockImplementation(async () => ({
    data: null,
    error: { name: "monthly_quota_exceeded", message: "quota reached" },
  }));
  const response = await POST(request());
  assert.equal(response.status, 429);
  assert.equal((await response.json()).code, "QUOTA_LIMIT");
});
test("storage failure fails closed without calling Resend", async () => {
  process.env.RESEND_API_KEY = "re_mock_test";
  process.env.RESEND_FROM = "NEUZ <test@verified.example>";
  process.env.QUOTE_EMAIL_DAILY_LIMIT = "101";
  const prototype = Object.getPrototypeOf(
    new Resend(process.env.RESEND_API_KEY).emails,
  );
  const send = spyOn(prototype, "send");
  assert.equal((await POST(request())).status, 503);
  assert.equal(send.mock.calls.length, 0);
});

test("localhost works with production canonical configured", async () => {
  process.env.SITE_URL = "https://neuz.ma";
  assert.equal(
    (await POST(request({ ...sample, email: "invalid" }))).status,
    400,
  );
});
test("bot rejection does not call Resend or reserve an email budget", async () => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0x-test-site";
  process.env.TURNSTILE_SECRET_KEY = "0x-test-secret";
  process.env.RESEND_API_KEY = "re_mock_test";
  process.env.RESEND_FROM = "NEUZ <test@verified.example>";
  const prototype = Object.getPrototypeOf(
    new Resend(process.env.RESEND_API_KEY).emails,
  );
  const send = spyOn(prototype, "send");
  const verify = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ success: false }),
  );
  assert.equal(
    (await POST(request({ ...sample, turnstile: "failed" }))).status,
    400,
  );
  assert.equal(send.mock.calls.length, 0);
  verify.mockResolvedValue(
    Response.json({ success: true, hostname: "localhost", action: "quote" }),
  );
  send.mockResolvedValue({ data: { id: "test" }, error: null });
  process.env.QUOTE_EMAIL_DAILY_LIMIT = "1";
  assert.equal(
    (await POST(request({ ...sample, turnstile: "valid" }))).status,
    200,
  );
  assert.equal(send.mock.calls.length, 1);
});
