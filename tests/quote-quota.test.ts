import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  LocalQuoteEmailQuotaStore,
  DAY_MS,
  MONTH_MS,
  quoteEmailBudget,
} from "../src/lib/quote-email-quota";
import {
  LocalQuoteLimitStore,
  normalizeClientIp,
  quoteClient,
} from "../src/lib/quote-rate-limit";
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "neuz-quota-test-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
test("concurrent instances reserve only the available daily slots", async () => {
  const results = await Promise.all(
    Array.from({ length: 12 }, () =>
      new LocalQuoteEmailQuotaStore(directory).reserve({
        daily: 3,
        monthly: 10,
      }),
    ),
  );
  expect(results.filter((r) => r.allowed)).toHaveLength(3);
  expect(
    (
      await new LocalQuoteEmailQuotaStore(directory).reserve({
        daily: 3,
        monthly: 10,
      })
    ).allowed,
  ).toBe(false);
});
test("daily reset cannot bypass rolling monthly cap and both windows expire", async () => {
  let now = Date.UTC(2026, 8, 1);
  const start = now;
  const store = new LocalQuoteEmailQuotaStore(directory, () => now);
  const budget = { daily: 1, monthly: 2 };
  expect((await store.reserve(budget)).allowed).toBe(true);
  expect((await store.reserve(budget)).retryAfter).toBe(86400);
  now += DAY_MS;
  expect((await store.reserve(budget)).allowed).toBe(true);
  now += DAY_MS;
  expect((await store.reserve(budget)).allowed).toBe(false);
  expect((await store.reserve(budget)).retryAfter).toBe(29 * 86400);
  now = start + MONTH_MS;
  expect((await store.reserve(budget)).allowed).toBe(true);
});
test("shared per-client limiter persists and separates clients", async () => {
  for (let i = 0; i < 5; i++)
    expect(
      (await new LocalQuoteLimitStore(directory).consume("client-a", 5, 900))
        .allowed,
    ).toBe(true);
  expect(
    (await new LocalQuoteLimitStore(directory).consume("client-a", 5, 900))
      .allowed,
  ).toBe(false);
  expect(
    (await new LocalQuoteLimitStore(directory).consume("client-b", 5, 900))
      .allowed,
  ).toBe(true);
});
test("IPv6 suffix rotation and IPv4-mapped aliases share a client key", () => {
  expect(normalizeClientIp("::ffff:192.0.2.1")).toBe("192.0.2.1");
  expect(normalizeClientIp("2001:db8:1:2::1")).toBe(
    normalizeClientIp("2001:db8:1:2::abcd"),
  );
});
test("invalid email budgets cannot exceed the provider ceilings", () => {
  const old = process.env.QUOTE_EMAIL_DAILY_LIMIT;
  try {
    process.env.QUOTE_EMAIL_DAILY_LIMIT = "101";
    expect(() => quoteEmailBudget()).toThrow();
  } finally {
    if (old === undefined) delete process.env.QUOTE_EMAIL_DAILY_LIMIT;
    else process.env.QUOTE_EMAIL_DAILY_LIMIT = old;
  }
});
test("Vercel client detection ignores spoofed generic forwarding headers", () => {
  const old = process.env.VERCEL;
  try {
    process.env.VERCEL = "1";
    expect(
      quoteClient(
        new Request("https://neuz.ma/api/quote", {
          headers: {
            "x-vercel-forwarded-for": "192.0.2.1",
            "x-forwarded-for": "192.0.2.2",
          },
        }),
      ),
    ).toBe("192.0.2.1");
    expect(() =>
      quoteClient(
        new Request("https://neuz.ma/api/quote", {
          headers: { "x-forwarded-for": "192.0.2.2" },
        }),
      ),
    ).toThrow();
  } finally {
    if (old === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = old;
  }
});
