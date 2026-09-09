import { beforeEach, afterEach, test, expect, spyOn, mock } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { trustedRequestOrigin } from "../src/lib/request-origin";
import { verifyTurnstile } from "../src/lib/turnstile";
import { limitAdmin } from "../src/lib/admin-rate-limit";
import { LocalQuoteLimitStore, limitQuote } from "../src/lib/quote-rate-limit";
import { AdminAccounts } from "../src/lib/admin-account";
import { hashPassword } from "../src/lib/admin-auth";
import { LocalCatalogStorage, storageMode } from "../src/lib/catalog-storage";
import { quoteClient } from "../src/lib/quote-rate-limit";
import { isPreviewDeployment } from "../src/lib/deployment";
import { POST as login } from "../src/app/api/admin/login/route";
const keys = [
  "SITE_URL",
  "NEUZ_NETLIFY_CONTEXT",
  "NEUZ_NETLIFY_ORIGIN",
  "NODE_ENV",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_BRANCH_URL",
  "TRUSTED_PREVIEW_ORIGINS",
  "TRUSTED_CLIENT_IP_HEADER",
  "QUOTE_TRUSTED_IP_HEADER",
  "CATALOG_STORAGE",
  "CATALOG_DATA_DIR",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_PASSWORD_HASH",
  "ADMIN_SESSION_SECRET",
  "QUOTE_RATE_LIMIT_SECRET",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
];
let previous: Record<string, string | undefined>;
let directory: string;
beforeEach(async () => {
  previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  directory = await mkdtemp(join(tmpdir(), "neuz-launch-security-"));
  Object.assign(process.env, {
    NODE_ENV: "test",
    SITE_URL: "https://neuz.ma",
    CATALOG_STORAGE: "local",
    CATALOG_DATA_DIR: directory,
    ADMIN_SESSION_SECRET: "launch-test-secret-".repeat(3),
    TRUSTED_CLIENT_IP_HEADER: "x-test-client",
  });
});
afterEach(async () => {
  mock.restore();
  for (const [k, v] of Object.entries(previous)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  await rm(directory, { recursive: true, force: true });
});
function request(
  origin = "http://localhost:3000",
  ip = "192.0.2.1",
  body?: unknown,
) {
  return new NextRequest("http://localhost:3000/api/admin/login", {
    method: "POST",
    headers: {
      origin,
      "x-test-client": ip,
      "content-type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
}
test("production canonical and same-port localhost work; arbitrary host spoofing and origins fail", () => {
  expect(trustedRequestOrigin(request())).toBe("http://localhost:3000");
  expect(trustedRequestOrigin(request("https://neuz.ma"))).toBe(
    "https://neuz.ma",
  );
  for (const origin of [
    "https://evil.example",
    "null",
    "http://localhost:9000",
    "https://neuz.ma.evil.example",
    "https://neuz.ma/path",
  ]) {
    expect(trustedRequestOrigin(request(origin))).toBeNull();
  }
  expect(
    trustedRequestOrigin(
      new Request("https://internal.example/api", {
        headers: { host: "evil.example", origin: "https://evil.example" },
      }),
    ),
  ).toBeNull();
});
test("only this Vercel preview's exact configured origins are accepted", () => {
  Object.assign(process.env, {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_URL: "neuz-test-123.vercel.app",
    VERCEL_BRANCH_URL: "neuz-git-test.vercel.app",
  });
  expect(
    trustedRequestOrigin(request("https://neuz-test-123.vercel.app")),
  ).toBe("https://neuz-test-123.vercel.app");
  expect(
    trustedRequestOrigin(request("https://neuz-git-test.vercel.app")),
  ).toBe("https://neuz-git-test.vercel.app");
  expect(
    trustedRequestOrigin(request("https://someone-else.vercel.app")),
  ).toBeNull();
  expect(trustedRequestOrigin(request())).toBeNull();
  process.env.VERCEL_ENV = "production";
  expect(
    trustedRequestOrigin(request("https://neuz-test-123.vercel.app")),
  ).toBeNull();
});
test("explicit preview allowlist accepts exact HTTPS origins only", () => {
  process.env.TRUSTED_PREVIEW_ORIGINS =
    "https://preview.neuz.ma, https://*.vercel.app, http://unsafe.example";
  expect(trustedRequestOrigin(request("https://preview.neuz.ma"))).toBe(
    "https://preview.neuz.ma",
  );
  expect(trustedRequestOrigin(request("https://other.vercel.app"))).toBeNull();
  expect(trustedRequestOrigin(request("http://unsafe.example"))).toBeNull();
});
test("bad logins from A do not stop correct login from B or change catalog revisions", async () => {
  const account = await new AdminAccounts().seed({
    username: "admin",
    passwordHash: hashPassword("test-current-password"),
  });
  const storage = new LocalCatalogStorage(directory);
  const initial = await storage.read();
  // Historical account-wide lockout data must no longer affect authentication.
  await storage.compareAndSwap(initial.version, {
    ...initial.document,
    loginAttempts: Array(20).fill(Date.now()),
  });
  const version = (await storage.read()).version;
  for (let i = 0; i < 20; i++)
    expect(
      (
        await login(
          request(undefined, "192.0.2.1", {
            username: "admin",
            password: "wrong",
          }),
        )
      ).status,
    ).toBe(401);
  const blocked = await login(
    request(undefined, "192.0.2.1", {
      username: "admin",
      password: "test-current-password",
    }),
  );
  expect(blocked.status).toBe(429);
  expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
  const allowed = await login(
    request(undefined, "192.0.2.2", {
      username: account.username,
      password: "test-current-password",
    }),
  );
  expect(allowed.status).toBe(200);
  expect((await storage.read()).version).toBe(version);
});
test("persistent admin limits expire and account/quote actions have separate buckets", async () => {
  let now = 1000;
  const store = () =>
    new LocalQuoteLimitStore(join(directory, "limits"), () => now);
  for (let i = 0; i < 20; i++) await limitAdmin(request(), "login", store());
  await expect(limitAdmin(request(), "login", store())).rejects.toMatchObject({
    status: 429,
  });
  await limitAdmin(request(), "account", store());
  await limitQuote("ip", "192.0.2.1", store());
  now += 900000;
  await limitAdmin(request(), "login", store());
});
test("missing shared store never falls back to unthrottled login", async () => {
  await expect(
    limitAdmin(request(), "login", {
      consume: async () => {
        throw Error("offline");
      },
    }),
  ).rejects.toMatchObject({ status: 503 });
});
function configureBot() {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0x-real-site-test";
  process.env.TURNSTILE_SECRET_KEY = "0x-real-secret-test";
}
test("hosted requests require both real Turnstile keys and a token", async () => {
  process.env.VERCEL = "1";
  await expect(
    verifyTurnstile(request("https://neuz.ma"), undefined, "quote"),
  ).rejects.toMatchObject({ status: 503 });
  configureBot();
  await expect(
    verifyTurnstile(request("https://neuz.ma"), undefined, "quote"),
  ).rejects.toMatchObject({ status: 400 });
  process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
  await expect(
    verifyTurnstile(request("https://neuz.ma"), "dummy", "quote"),
  ).rejects.toMatchObject({ status: 503 });
});
test("local development can omit keys; partial config always fails closed", async () => {
  await verifyTurnstile(request(), undefined, "quote");
  process.env.TURNSTILE_SECRET_KEY = "secret";
  await expect(
    verifyTurnstile(request(), "token", "quote"),
  ).rejects.toMatchObject({ status: 503 });
});
test("Turnstile binds tokens to actual trusted origin and form action", async () => {
  configureBot();
  process.env.TRUSTED_PREVIEW_ORIGINS = "https://preview.neuz.ma";
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      success: true,
      hostname: "preview.neuz.ma",
      action: "quote",
    }),
  );
  await verifyTurnstile(
    request("https://preview.neuz.ma"),
    "valid-token",
    "quote",
  );
  expect(fetchMock.mock.calls.length).toBe(1);
  for (const result of [
    null,
    { success: false },
    { success: true, hostname: "neuz.ma", action: "quote" },
    { success: true, hostname: "preview.neuz.ma", action: "admin_login" },
  ]) {
    fetchMock.mockResolvedValue(Response.json(result));
    await expect(
      verifyTurnstile(
        request("https://preview.neuz.ma"),
        "invalid-token",
        "quote",
      ),
    ).rejects.toMatchObject({ status: 400 });
  }
});
test("Turnstile failures reject login and provider outage fails closed", async () => {
  configureBot();
  await new AdminAccounts().seed({
    username: "admin",
    passwordHash: hashPassword("test-current-password"),
  });
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] }),
  );
  expect(
    (
      await login(
        request(undefined, "192.0.2.3", {
          username: "admin",
          password: "test-current-password",
          turnstile: "expired",
        }),
      )
    ).status,
  ).toBe(400);
  fetchMock.mockRejectedValue(Error("network"));
  await expect(
    verifyTurnstile(request(), "token", "quote"),
  ).rejects.toMatchObject({ status: 503 });
});

test("Netlify trusts only its compiled deployment origin and keeps local bypass disabled", () => {
  process.env.NEUZ_NETLIFY_CONTEXT = "deploy-preview";
  process.env.NEUZ_NETLIFY_ORIGIN =
    "https://deploy-preview-8--neuz.netlify.app";
  expect(trustedRequestOrigin(request(process.env.NEUZ_NETLIFY_ORIGIN))).toBe(
    process.env.NEUZ_NETLIFY_ORIGIN,
  );
  for (const origin of [
    "https://someone-else.netlify.app",
    "https://deploy-preview-9--neuz.netlify.app",
    "https://deploy-preview-8--neuz.netlify.app.evil.example",
    "http://localhost:3000",
  ])
    expect(trustedRequestOrigin(request(origin))).toBeNull();
  process.env.NEUZ_NETLIFY_CONTEXT = "production";
  expect(trustedRequestOrigin(request("https://neuz.ma"))).toBe(
    "https://neuz.ma",
  );
  expect(trustedRequestOrigin(request(process.env.NEUZ_NETLIFY_ORIGIN))).toBe(
    process.env.NEUZ_NETLIFY_ORIGIN,
  );
  for (const invalid of [
    "http://preview.example",
    "https://preview.example/path",
    "https://user:password@preview.example",
  ]) {
    process.env.NEUZ_NETLIFY_ORIGIN = invalid;
    expect(trustedRequestOrigin(request("https://preview.example"))).toBeNull();
  }
  delete process.env.NEUZ_NETLIFY_CONTEXT;
  process.env.NEUZ_NETLIFY_ORIGIN = "https://untrusted.example";
  expect(trustedRequestOrigin(request("https://untrusted.example"))).toBeNull();
});

test("Netlify client limits use the platform header and reject missing or ambiguous IPs", () => {
  process.env.NEUZ_NETLIFY_CONTEXT = "production";
  const incoming = (ip?: string) =>
    new Request("https://neuz.ma/api/quote", {
      headers: {
        "x-forwarded-for": "192.0.2.99",
        "x-test-client": "192.0.2.88",
        ...(ip === undefined ? {} : { "x-nf-client-connection-ip": ip }),
      },
    });
  expect(quoteClient(incoming("203.0.113.25"))).toBe("203.0.113.25");
  expect(quoteClient(incoming("::ffff:203.0.113.25"))).toBe("203.0.113.25");
  for (const ip of [undefined, "", "not-an-ip", "203.0.113.25, 192.0.2.1"])
    expect(() => quoteClient(incoming(ip))).toThrow();
});

test("Netlify previews stay noindex even when the canonical site is configured", () => {
  for (const context of ["deploy-preview", "branch-deploy", "dev", "unknown"]) {
    process.env.NEUZ_NETLIFY_CONTEXT = context;
    expect(isPreviewDeployment()).toBe(true);
  }
  process.env.NEUZ_NETLIFY_CONTEXT = "production";
  expect(isPreviewDeployment()).toBe(false);
  delete process.env.NEUZ_NETLIFY_CONTEXT;
  expect(isPreviewDeployment()).toBe(false);
  process.env.VERCEL_ENV = "preview";
  expect(isPreviewDeployment()).toBe(true);
});

test("Netlify cannot fall back to local storage or bypass hosted Turnstile", async () => {
  process.env.NEUZ_NETLIFY_CONTEXT = "deploy-preview";
  expect(() => storageMode()).toThrow();
  await expect(
    verifyTurnstile(request("https://neuz.ma"), undefined, "quote"),
  ).rejects.toMatchObject({ status: 503 });
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
  process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
  await expect(
    verifyTurnstile(request("https://neuz.ma"), "test-token", "quote"),
  ).rejects.toMatchObject({ status: 503 });
});
