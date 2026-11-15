-- BarberBook: one administrator, service management and weekly opening hours.
-- Run this script once in Supabase Dashboard > SQL Editor for a fresh project.
-- The existing project has already received this migration.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists private.admin_config (
  singleton boolean primary key default true check (singleton),
  admin_user_id uuid null references auth.users(id) on delete set null
);
revoke all on table private.admin_config from public, anon, authenticated;
insert into private.admin_config (singleton, admin_user_id)
values (true, null)
on conflict (singleton) do nothing;

create or replace function private.is_barberbook_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.admin_config
    where singleton = true and admin_user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_barberbook_admin() from public, anon, authenticated;
grant execute on function private.is_barberbook_admin() to authenticated;

create or replace function public.is_barberbook_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_barberbook_admin(); $$;
revoke all on function public.is_barberbook_admin() from public, anon;
grant execute on function public.is_barberbook_admin() to authenticated;

create table if not exists public.business_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  is_open boolean not null default false,
  opens_at time without time zone,
  closes_at time without time zone,
  break_start time without time zone,
  break_end time without time zone,
  updated_at timestamptz not null default now(),
  constraint business_hours_valid_window check (
    (is_open and opens_at is not null and closes_at is not null and opens_at < closes_at)
    or
    (not is_open and opens_at is null and closes_at is null and break_start is null and break_end is null)
  ),
  constraint business_hours_valid_break check (
    (break_start is null and break_end is null)
    or
    (is_open and break_start is not null and break_end is not null
      and opens_at <= break_start and break_start < break_end and break_end <= closes_at)
  )
);

insert into public.business_hours (weekday, is_open)
select day_number, false from generate_series(0, 6) as day_number
on conflict (weekday) do nothing;

alter table public.business_hours enable row level security;
drop policy if exists business_hours_public_read on public.business_hours;
create policy business_hours_public_read on public.business_hours for select to anon, authenticated using (true);
drop policy if exists business_hours_admin_insert on public.business_hours;
create policy business_hours_admin_insert on public.business_hours for insert to authenticated with check ((select private.is_barberbook_admin()));
drop policy if exists business_hours_admin_update on public.business_hours;
create policy business_hours_admin_update on public.business_hours for update to authenticated
using ((select private.is_barberbook_admin()))
with check ((select private.is_barberbook_admin()));
grant select on public.business_hours to anon, authenticated;
grant insert, update on public.business_hours to authenticated;

drop policy if exists services_admin_select on public.services;
create policy services_admin_select on public.services for select to authenticated using ((select private.is_barberbook_admin()));
drop policy if exists services_admin_insert on public.services;
create policy services_admin_insert on public.services for insert to authenticated with check ((select private.is_barberbook_admin()));
drop policy if exists services_admin_update on public.services;
create policy services_admin_update on public.services for update to authenticated
using ((select private.is_barberbook_admin()))
with check ((select private.is_barberbook_admin()));
grant select on public.services to anon, authenticated;
grant insert, update on public.services to authenticated;
