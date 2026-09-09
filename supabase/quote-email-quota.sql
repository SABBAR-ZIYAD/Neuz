-- Run alongside quote-limits.sql. One row serializes reservations across all instances.
-- Reservations count attempts, including uncertain failures; there are no automatic refunds.
begin;
create table if not exists public.neuz_quote_email_quota (
  id text primary key check (id = 'resend-quotes'),
  reservations timestamptz[] not null default '{}'
);
alter table public.neuz_quote_email_quota enable row level security;
revoke all on public.neuz_quote_email_quota from public, anon, authenticated;
grant select, insert, update on public.neuz_quote_email_quota to service_role;
create or replace function public.neuz_reserve_quote_email(p_daily integer, p_monthly integer)
returns table (allowed boolean, retry_after integer)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_now timestamptz;
  v_events timestamptz[];
  v_day timestamptz[];
  v_month_count integer;
  v_day_count integer;
  v_wait integer := 0;
begin
  if p_daily is null or p_daily < 1 or p_daily > 100 or p_monthly is null or p_monthly < 1 or p_monthly > 3000 then
    raise exception 'Invalid quote email budget';
  end if;
  insert into public.neuz_quote_email_quota (id) values ('resend-quotes') on conflict (id) do nothing;
  select reservations into v_events from public.neuz_quote_email_quota where id='resend-quotes' for update;
  v_now := clock_timestamp();
  select coalesce(array_agg(t order by t), '{}'::timestamptz[]) into v_events from unnest(v_events) as event(t) where t > v_now - interval '744 hours';
  select coalesce(array_agg(t order by t), '{}'::timestamptz[]) into v_day from unnest(v_events) as event(t) where t > v_now - interval '24 hours';
  v_month_count := cardinality(v_events);
  v_day_count := cardinality(v_day);
  if v_month_count >= p_monthly then
    v_wait := greatest(v_wait, ceil(extract(epoch from (v_events[v_month_count-p_monthly+1] + interval '744 hours' - v_now)))::integer);
  end if;
  if v_day_count >= p_daily then
    v_wait := greatest(v_wait, ceil(extract(epoch from (v_day[v_day_count-p_daily+1] + interval '24 hours' - v_now)))::integer);
  end if;
  if v_wait > 0 then return query select false, v_wait; return; end if;
  update public.neuz_quote_email_quota set reservations=array_append(v_events,v_now) where id='resend-quotes';
  return query select true, 0;
end;
$$;
revoke all on function public.neuz_reserve_quote_email(integer,integer) from public, anon, authenticated;
grant execute on function public.neuz_reserve_quote_email(integer,integer) to service_role;
commit;
