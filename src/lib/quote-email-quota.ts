import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dataDirectory, storageMode, supabase } from "./catalog-storage";
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MONTH_MS = 31 * DAY_MS;
export type EmailBudget = { daily: number; monthly: number };
export type QuotaDecision = { allowed: boolean; retryAfter: number };
export interface QuoteEmailQuotaStore {
  reserve(budget: EmailBudget): Promise<QuotaDecision>;
}
export class QuoteEmailQuotaExceeded extends Error {
  constructor(public retryAfter: number) {
    super("Quote email budget reached");
  }
}
function configuredLimit(
  value: string | undefined,
  fallback: number,
  ceiling: number,
) {
  if (!value?.trim()) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > ceiling)
    throw Error("Invalid quote email budget");
  return Number(value);
}
export function quoteEmailBudget(): EmailBudget {
  return {
    daily: configuredLimit(process.env.QUOTE_EMAIL_DAILY_LIMIT, 90, 100),
    monthly: configuredLimit(process.env.QUOTE_EMAIL_MONTHLY_LIMIT, 2700, 3000),
  };
}
export function quotaDecision(
  reservations: number[],
  now: number,
  budget: EmailBudget,
): QuotaDecision {
  const windows = [
    { duration: DAY_MS, limit: budget.daily },
    { duration: MONTH_MS, limit: budget.monthly },
  ];
  let retryAfter = 0;
  for (const window of windows) {
    const active = reservations
      .filter((time) => time > now - window.duration)
      .sort((a, b) => a - b);
    if (active.length >= window.limit)
      retryAfter = Math.max(
        retryAfter,
        Math.ceil(
          (active[active.length - window.limit] + window.duration - now) / 1000,
        ),
      );
  }
  return { allowed: retryAfter === 0, retryAfter };
}
export class LocalQuoteEmailQuotaStore implements QuoteEmailQuotaStore {
  constructor(
    private directory = join(dataDirectory(), "quote-email-quota"),
    private now = Date.now,
  ) {}
  async reserve(budget: EmailBudget): Promise<QuotaDecision> {
    await mkdir(this.directory, { recursive: true });
    const lock = join(this.directory, "write.lock");
    let acquired = false;
    for (let i = 0; i < 100; i++) {
      try {
        await mkdir(lock);
        acquired = true;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    if (!acquired) throw Error("Quote quota storage busy");
    try {
      const file = join(this.directory, "reservations.json");
      const value: unknown = await readFile(file, "utf8")
        .then(JSON.parse)
        .catch((error) => {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
          throw error;
        });
      if (
        !Array.isArray(value) ||
        !value.every((time) => Number.isSafeInteger(time) && time >= 0)
      )
        throw Error("Invalid quota storage");
      const now = this.now();
      const reservations = (value as number[]).filter(
        (time) => time > now - MONTH_MS,
      );
      const result = quotaDecision(reservations, now, budget);
      if (result.allowed) {
        reservations.push(now);
        const temporary = join(this.directory, randomUUID() + ".tmp");
        await writeFile(temporary, JSON.stringify(reservations), {
          mode: 0o600,
        });
        await rename(temporary, file);
      }
      return result;
    } finally {
      await rmdir(lock);
    }
  }
}
export class SupabaseQuoteEmailQuotaStore implements QuoteEmailQuotaStore {
  async reserve(budget: EmailBudget): Promise<QuotaDecision> {
    const { data, error } = await supabase().rpc("neuz_reserve_quote_email", {
      p_daily: budget.daily,
      p_monthly: budget.monthly,
    });
    const result = data?.[0];
    if (
      error ||
      typeof result?.allowed !== "boolean" ||
      !Number.isInteger(result?.retry_after) ||
      result.retry_after < 0
    )
      throw Error("Quote quota storage unavailable");
    return { allowed: result.allowed, retryAfter: result.retry_after };
  }
}
export async function reserveQuoteEmail(
  store: QuoteEmailQuotaStore = storageMode() === "supabase"
    ? new SupabaseQuoteEmailQuotaStore()
    : new LocalQuoteEmailQuotaStore(),
) {
  const result = await store.reserve(quoteEmailBudget());
  if (!result.allowed) throw new QuoteEmailQuotaExceeded(result.retryAfter);
}
