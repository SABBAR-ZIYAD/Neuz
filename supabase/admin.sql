-- Run once in the Supabase SQL editor. Only the server service-role key can read/write the catalog.
create table if not exists public.neuz_catalog (
  id text primary key check (id = 'main'),
  version bigint not null default 1 check (version > 0),
  document jsonb not null check (jsonb_typeof(document) = 'object')
);
alter table public.neuz_catalog enable row level security;
revoke all on public.neuz_catalog from anon, authenticated;
grant select, insert, update on public.neuz_catalog to service_role;
-- Product photos are public. Uploads/deletions are performed only by the authenticated server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('neuz-products', 'neuz-products', true, 3145728, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
