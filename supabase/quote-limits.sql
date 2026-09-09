-- Apply after admin.sql. Safe to rerun. No public/client access to counters or RPC.
begin;
create table if not exists public.neuz_quote_limits (
  key text primary key check (key ~ '^quote:(ip|email):[a-f0-9]{64}$'),
  hits integer not null check (hits > 0),
  expires_at timestamptz not null
);
create index if not exists neuz_quote_limits_expiry on public.neuz_quote_limits (expires_at);
alter table public.neuz_quote_limits enable row level security;
revoke all on public.neuz_quote_limits from public, anon, authenticated;
grant select, insert, update, delete on public.neuz_quote_limits to service_role;
create or replace function public.neuz_consume_quote_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, retry_after integer)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_hits integer;
  v_expires timestamptz;
begin
  if p_key is null or p_key !~ '^quote:(ip|email):[a-f0-9]{64}$'
     or p_limit is null or p_limit < 1 or p_limit > 100
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;
  -- Remove expired identifiers during traffic; retain no email or raw IP address.
  delete from public.neuz_quote_limits where expires_at < v_now - interval '1 day';
  insert into public.neuz_quote_limits as bucket (key, hits, expires_at)
    values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    hits = case when bucket.expires_at <= v_now then 1 else least(bucket.hits + 1, p_limit + 1) end,
    expires_at = case when bucket.expires_at <= v_now then v_now + make_interval(secs => p_window_seconds) else bucket.expires_at end
  returning hits, expires_at into v_hits, v_expires;
  return query select v_hits <= p_limit,
    case when v_hits <= p_limit then 0 else greatest(1, ceil(extract(epoch from (v_expires-v_now)))::integer) end;
end;
$$;
revoke all on function public.neuz_consume_quote_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.neuz_consume_quote_limit(text, integer, integer) to service_role;
commit;
