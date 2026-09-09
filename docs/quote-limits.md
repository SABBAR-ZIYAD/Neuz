# Quote email limits

The quote form sends one transactional email to the owner through Resend. To protect the free plan allowance (100/day, 3,000/month), defaults reserve **90 send attempts in any rolling 24 hours** and **2,700 in any rolling 31 days**. These are application budgets, not live Resend usage counters. A rolling 31-day window is deliberately more conservative than a calendar-month reset and avoids assuming the provider's billing reset date.

## Limits

| Scope | Limit | Storage |
| --- | --- | --- |
| Client IP (IPv6 grouped by /64) | 5 requests / 15 minutes | Shared Supabase counter |
| Normalized email address | 5 eligible submissions / hour | Shared Supabase counter |
| All quote sends | 90 attempts / rolling 24 hours | Atomic shared reservation |
| All quote sends | 2,700 attempts / rolling 31 days | Same atomic reservation |

Set QUOTE_EMAIL_DAILY_LIMIT and QUOTE_EMAIL_MONTHLY_LIMIT to lower budgets as desired; maximum values are 100 and 3000. Invalid configuration blocks sending. The defaults apply if unset. Every send passes field/file validation, mandatory hosted bot verification and client limits before reserving the global budget. Daily and monthly checks share one database row lock, preventing multiple serverless instances from exceeding the available slots concurrently.

Reservations count attempted sends, including provider errors, network timeouts and retries. They are never automatically refunded because the provider may have accepted an email even when its response is lost. This intentionally underuses the allowance in uncertain cases. Resend's existing idempotency key still prevents duplicate delivery within its supported retention window; duplicate attempts can consume additional local reservations. A blocked reservation consumes no additional slot and never calls Resend.

A local/global limit responds with HTTP 429 and Retry-After. Quota errors show a translated message explaining that the request was not sent, retain the form content, and offer direct email/WhatsApp contact. Resend daily/monthly quota errors use the same fallback; provider rate-limit errors use the existing retry message. Requests are not queued or automatically emailed later. Storage failure returns 503 and does not call Resend.

## Production setup

1. Configure the existing Supabase server URL and service-role key.
2. Apply supabase/quote-limits.sql and supabase/quote-email-quota.sql in the same Supabase project, in addition to admin.sql. These migrations can be rerun. Tables have RLS; access and RPC execution are restricted to service_role. There is no client-side key access.
3. Configure a stable QUOTE_RATE_LIMIT_SECRET with at least 32 random characters. It falls back to ADMIN_SESSION_SECRET, but using a separate secret prevents admin credential recovery from resetting per-client identities. Only HMAC identifiers and counters are stored for client limits; the global quota holds timestamps only.
4. Vercel uses x-vercel-forwarded-for. Other hosts require TRUSTED_CLIENT_IP_HEADER (or the legacy QUOTE_TRUSTED_IP_HEADER) pointing to a single-IP header that the trusted ingress overwrites. Never trust a header that visitors can freely supply. Missing/invalid trusted client information blocks sending. Local previews share one local-preview client key.
5. Set the budget variables if different from 90/2700. All production instances must share the same database and policy. Preview tests should use isolated storage and a mocked email provider, not consume production budgets.
6. Configure both Turnstile keys for mandatory hosted challenge protection; see [launch security](launch-security.md) for activation and preview settings. Quotas cap spending but do not prevent a distributed attacker from consuming the allowance. Hosted edge/WAF limits remain useful against request floods.

The deployed SQL/RPC must be applied to the configured Supabase project before launch. Local mode uses data/quote-limits and data/quote-email-quota, separate from product revisions. Never erase production counters during the active window: this would reset the protective budget. Local writers fail closed after a crash leaves write.lock; stop all local writers and confirm no process owns the lock before manually removing that lock directory.

## Resend accounting and rollout

[Resend quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits) include other outbound email, inbound email, and extra recipients. The quote budgets cannot see that outside usage. Keep the reserved headroom or lower these budgets if Resend is used elsewhere. When first enabling this system, inspect existing Resend usage and lower/pause quote sending as necessary; new counters do not include emails sent before installation. No provider credentials or raw customer email/IP data are stored in the global ledger.

[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) applies for 24 hours. These reservations remain conservative irrespective of provider retries. [Resend usage-limit errors](https://resend.com/docs/api-reference/rate-limit) are handled without displaying internal provider details to visitors.

Verification: bun run test covers cross-instance reservations, rolling resets, persisted per-client limits, trusted IP normalization, cap rejection before Resend, uncertain-send accounting and provider-quota fallback. Browser visual checks cover the quota error UI with intercepted responses; no real emails are sent.
