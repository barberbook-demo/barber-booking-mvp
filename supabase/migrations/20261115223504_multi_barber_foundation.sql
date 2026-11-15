
-- Multi-barber foundation. The legacy one-booking-per-start-time index is
-- deliberately retained until the new per-barber index is verified.

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 100),
  photo_path text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  is_initial boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index barbers_one_initial_idx on public.barbers (is_initial) where is_initial;

alter table public.barbers enable row level security;
revoke all on table public.barbers from public, anon, authenticated;
grant select on table public.barbers to anon, authenticated;
grant insert, update on table public.barbers to authenticated;

create policy barbers_public_active_read
on public.barbers for select to anon, authenticated
using (is_active = true);

create policy barbers_admin_read
on public.barbers for select to authenticated
using ((select private.is_barberbook_admin()));

create policy barbers_admin_insert
on public.barbers for insert to authenticated
with check ((select private.is_barberbook_admin()));

create policy barbers_admin_update
on public.barbers for update to authenticated
using ((select private.is_barberbook_admin()))
with check ((select private.is_barberbook_admin()));

create table public.barber_business_hours (
  barber_id uuid not null references public.barbers(id) on delete restrict,
  weekday smallint not null check (weekday between 0 and 6),
  is_open boolean not null default false,
  opens_at time without time zone,
  closes_at time without time zone,
  break_start time without time zone,
  break_end time without time zone,
  updated_at timestamptz not null default now(),
  primary key (barber_id, weekday),
  constraint barber_hours_valid_schedule check (
    (is_open = false and opens_at is null and closes_at is null and break_start is null and break_end is null)
    or
    (is_open = true
      and opens_at is not null and closes_at is not null and opens_at < closes_at
      and extract(minute from opens_at) in (0, 30)
      and ((break_start is null and break_end is null)
        or (break_start is not null and break_end is not null
          and break_start < break_end and break_start >= opens_at and break_end <= closes_at)))
  )
);

alter table public.barber_business_hours enable row level security;
revoke all on table public.barber_business_hours from public, anon, authenticated;
grant select, insert, update on table public.barber_business_hours to authenticated;

create policy barber_hours_admin_read
on public.barber_business_hours for select to authenticated
using ((select private.is_barberbook_admin()));

create policy barber_hours_admin_insert
on public.barber_business_hours for insert to authenticated
with check ((select private.is_barberbook_admin()));

create policy barber_hours_admin_update
on public.barber_business_hours for update to authenticated
using ((select private.is_barberbook_admin()))
with check ((select private.is_barberbook_admin()));

create or replace function private.seed_barber_business_hours()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.barber_business_hours (
    barber_id, weekday, is_open, opens_at, closes_at, break_start, break_end
  )
  select new.id, h.weekday, h.is_open, h.opens_at, h.closes_at, h.break_start, h.break_end
  from public.business_hours as h
  on conflict (barber_id, weekday) do nothing;
  return new;
end;
$function$;

revoke all on function private.seed_barber_business_hours() from public, anon, authenticated;

create trigger barbers_seed_weekly_hours
after insert on public.barbers
for each row execute function private.seed_barber_business_hours();

insert into public.barbers (name, is_active, sort_order, is_initial)
values ('Κουρέας 1', true, 0, true)
on conflict (is_initial) where is_initial do nothing;

alter table public.bookings add column barber_id uuid;
update public.bookings
set barber_id = (select b.id from public.barbers as b where b.is_initial = true)
where barber_id is null;

alter table public.bookings
  add constraint bookings_barber_id_fkey
  foreign key (barber_id) references public.barbers(id) on delete restrict;

alter table public.bookings alter column barber_id set not null;

create index bookings_barber_starts_at_idx on public.bookings (barber_id, starts_at);
create unique index bookings_one_confirmed_per_barber_slot
on public.bookings (barber_id, starts_at)
where status = 'confirmed';

alter table public.blocked_periods
  add column barber_id uuid references public.barbers(id) on delete restrict;
create index blocked_periods_barber_range_idx
on public.blocked_periods (barber_id, starts_at, ends_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('barber-photos', 'barber-photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists barber_photos_public_read on storage.objects;
create policy barber_photos_public_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'barber-photos');

drop policy if exists barber_photos_admin_insert on storage.objects;
create policy barber_photos_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'barber-photos' and (select private.is_barberbook_admin()));

drop policy if exists barber_photos_admin_update on storage.objects;
create policy barber_photos_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'barber-photos' and (select private.is_barberbook_admin()))
with check (bucket_id = 'barber-photos' and (select private.is_barberbook_admin()));

drop policy if exists barber_photos_admin_delete on storage.objects;
create policy barber_photos_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'barber-photos' and (select private.is_barberbook_admin()));

-- Availability is the intersection of store hours and the selected barber's hours.
-- A NULL barber means "any active barber"; slots are returned once if at least one
-- active barber can take the appointment.
drop function if exists public.get_available_slots(date);
drop function if exists private.get_available_slots(date);

create function private.get_available_slots(
  p_date date,
  p_barber_id uuid default null
)
returns table(slot_time time without time zone)
language sql
stable
security definer
set search_path = ''
as $function$
  with store_hours as (
    select h.opens_at, h.closes_at, h.break_start, h.break_end
    from public.business_hours as h
    where h.weekday = extract(dow from p_date)::smallint
      and h.is_open = true
  ),
  candidates as (
    select
      b.id as barber_id,
      bh.opens_at as barber_opens_at,
      bh.closes_at as barber_closes_at,
      bh.break_start as barber_break_start,
      bh.break_end as barber_break_end,
      sh.opens_at as store_opens_at,
      sh.closes_at as store_closes_at,
      sh.break_start as store_break_start,
      sh.break_end as store_break_end,
      generated.local_start,
      generated.local_start at time zone 'Europe/Athens' as starts_at
    from store_hours as sh
    join public.barber_business_hours as bh
      on bh.weekday = extract(dow from p_date)::smallint
      and bh.is_open = true
    join public.barbers as b
      on b.id = bh.barber_id and b.is_active = true
    cross join lateral pg_catalog.generate_series(
      p_date::timestamp + sh.opens_at,
      p_date::timestamp + sh.closes_at - interval '30 minutes',
      interval '30 minutes'
    ) as generated(local_start)
    where p_barber_id is null or b.id = p_barber_id
  )
  select distinct c.local_start::time as slot_time
  from candidates as c
  where c.starts_at > pg_catalog.now()
    and (c.starts_at at time zone 'Europe/Athens') = c.local_start
    and c.local_start >= p_date::timestamp + greatest(c.store_opens_at, c.barber_opens_at)
    and c.local_start + interval '30 minutes'
      <= p_date::timestamp + least(c.store_closes_at, c.barber_closes_at)
    and not (
      c.store_break_start is not null
      and c.local_start < p_date::timestamp + c.store_break_end
      and c.local_start + interval '30 minutes' > p_date::timestamp + c.store_break_start
    )
    and not (
      c.barber_break_start is not null
      and c.local_start < p_date::timestamp + c.barber_break_end
      and c.local_start + interval '30 minutes' > p_date::timestamp + c.barber_break_start
    )
    and not exists (
      select 1 from public.bookings as bk
      where bk.barber_id = c.barber_id
        and bk.status = 'confirmed'
        and bk.starts_at < c.starts_at + interval '30 minutes'
        and bk.starts_at + interval '30 minutes' > c.starts_at
    )
    and not exists (
      select 1 from public.blocked_periods as bp
      where (bp.barber_id is null or bp.barber_id = c.barber_id)
        and bp.starts_at < c.starts_at + interval '30 minutes'
        and bp.ends_at > c.starts_at
    )
  order by slot_time;
$function$;

revoke all on function private.get_available_slots(date, uuid) from public, anon, authenticated;
grant execute on function private.get_available_slots(date, uuid) to anon, authenticated;

create function public.get_available_slots(
  p_date date,
  p_barber_id uuid default null
)
returns table(slot_time time without time zone)
language sql
stable
security invoker
set search_path = ''
as $function$
  select slots.slot_time
  from private.get_available_slots(p_date, p_barber_id) as slots;
$function$;

revoke all on function public.get_available_slots(date, uuid) from public;
grant execute on function public.get_available_slots(date, uuid) to anon, authenticated;

-- The global schedule lock serializes booking creation with block creation and
-- makes deterministic no-preference assignment plus insert one atomic decision.
drop function if exists public.create_booking(uuid, date, time without time zone, text, text, text);
drop function if exists private.create_booking(uuid, date, time without time zone, text, text, text);

create function private.create_booking(
  p_service_id uuid,
  p_date date,
  p_time time without time zone,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_barber_id uuid default null
)
returns table(booking_id uuid, starts_at timestamptz, barber_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_starts_at timestamptz;
  v_name text;
  v_phone text;
  v_email text;
  v_active boolean;
  v_barber_id uuid;
begin
  if p_date is null or p_time is null
     or extract(second from p_time) <> 0
     or extract(minute from p_time) not in (0, 30) then
    raise exception using errcode = '22023', message = 'INVALID_SLOT';
  end if;
  if p_date < (pg_catalog.now() at time zone 'Europe/Athens')::date then
    raise exception using errcode = '22023', message = 'INVALID_SLOT';
  end if;

  v_name := pg_catalog.btrim(p_customer_name);
  v_phone := pg_catalog.btrim(p_customer_phone);
  v_email := pg_catalog.lower(pg_catalog.btrim(p_customer_email));
  if v_name is null or pg_catalog.length(v_name) < 2 or pg_catalog.length(v_name) > 120
     or v_phone is null or pg_catalog.length(v_phone) > 30
     or pg_catalog.length(pg_catalog.regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 7 and 15
     or v_email is null or pg_catalog.length(v_email) > 254
     or v_email !~* '^[A-Z0-9.!#$%&''*+/=?^_{|}~-]+@[A-Z0-9]([A-Z0-9-]{0,61}[A-Z0-9])?([.][A-Z0-9]([A-Z0-9-]{0,61}[A-Z0-9])?)+$' then
    raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_DETAILS';
  end if;

  v_starts_at := (p_date::timestamp + p_time) at time zone 'Europe/Athens';
  if (v_starts_at at time zone 'Europe/Athens') <> (p_date::timestamp + p_time) then
    raise exception using errcode = '22023', message = 'INVALID_SLOT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('barberbook:schedule_mutation'), 1);

  select s.active into v_active
  from public.services as s
  where s.id = p_service_id
  for share;
  if not coalesce(v_active, false) then
    raise exception using errcode = 'P0001', message = 'SERVICE_UNAVAILABLE';
  end if;

  if p_barber_id is null then
    select b.id into v_barber_id
    from public.barbers as b
    where b.is_active = true
      and exists (
        select 1 from private.get_available_slots(p_date, b.id) as slot
        where slot.slot_time = p_time
      )
    order by b.sort_order, b.created_at, b.id
    limit 1;
  else
    select b.id into v_barber_id
    from public.barbers as b
    where b.id = p_barber_id and b.is_active = true;
    if v_barber_id is null then
      raise exception using errcode = 'P0001', message = 'BARBER_UNAVAILABLE';
    end if;
    if not exists (
      select 1 from private.get_available_slots(p_date, v_barber_id) as slot
      where slot.slot_time = p_time
    ) then
      raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
    end if;
  end if;

  if v_barber_id is null then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end if;

  insert into public.bookings (
    service_id, barber_id, customer_name, customer_phone, customer_email, starts_at, status
  )
  values (p_service_id, v_barber_id, v_name, v_phone, v_email, v_starts_at, 'confirmed')
  returning id, public.bookings.starts_at, public.bookings.barber_id
  into booking_id, starts_at, barber_id;

  return next;
end;
$function$;

revoke all on function private.create_booking(uuid, date, time without time zone, text, text, text, uuid) from public, anon, authenticated;
grant execute on function private.create_booking(uuid, date, time without time zone, text, text, text, uuid) to anon, authenticated;

create function public.create_booking(
  p_service_id uuid,
  p_date date,
  p_time time without time zone,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_barber_id uuid default null
)
returns table(booking_id uuid, starts_at timestamptz, barber_id uuid)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select created.booking_id, created.starts_at, created.barber_id
  from private.create_booking(
    p_service_id, p_date, p_time, p_customer_name, p_customer_phone, p_customer_email, p_barber_id
  ) as created;
$function$;

revoke all on function public.create_booking(uuid, date, time without time zone, text, text, text, uuid) from public;
grant execute on function public.create_booking(uuid, date, time without time zone, text, text, text, uuid) to anon, authenticated;

-- Shop-wide blocks conflict with every confirmed booking. A personal block
-- conflicts only with confirmed bookings assigned to that barber.
drop function if exists public.create_blocked_period(timestamp without time zone, timestamp without time zone, text);
drop function if exists private.create_blocked_period(timestamp without time zone, timestamp without time zone, text);

create function private.create_blocked_period(
  p_starts_at timestamp without time zone,
  p_ends_at timestamp without time zone,
  p_reason text default null,
  p_barber_id uuid default null
)
returns table(blocked_period_id uuid, conflicting_bookings jsonb)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_reason text;
begin
  if not private.is_barberbook_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_ONLY';
  end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at then
    raise exception using errcode = '22023', message = 'INVALID_BLOCKED_PERIOD';
  end if;
  if p_barber_id is not null and not exists (
    select 1 from public.barbers where id = p_barber_id
  ) then
    raise exception using errcode = '22023', message = 'INVALID_BARBER';
  end if;

  v_starts_at := p_starts_at at time zone 'Europe/Athens';
  v_ends_at := p_ends_at at time zone 'Europe/Athens';
  if (v_starts_at at time zone 'Europe/Athens') <> p_starts_at
     or (v_ends_at at time zone 'Europe/Athens') <> p_ends_at then
    raise exception using errcode = '22023', message = 'INVALID_LOCAL_TIME';
  end if;

  v_reason := nullif(pg_catalog.btrim(p_reason), '');
  if v_reason is not null and pg_catalog.length(v_reason) > 160 then
    raise exception using errcode = '22023', message = 'REASON_TOO_LONG';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('barberbook:schedule_mutation'), 1);

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', b.id,
        'customer_name', b.customer_name,
        'service_name', s.name,
        'barber_name', br.name,
        'starts_at', b.starts_at
      ) order by b.starts_at
    ),
    '[]'::jsonb
  )
  into conflicting_bookings
  from public.bookings as b
  left join public.services as s on s.id = b.service_id
  left join public.barbers as br on br.id = b.barber_id
  where b.status = 'confirmed'
    and (p_barber_id is null or b.barber_id = p_barber_id)
    and b.starts_at < v_ends_at
    and b.starts_at + interval '30 minutes' > v_starts_at;

  if pg_catalog.jsonb_array_length(conflicting_bookings) > 0 then
    blocked_period_id := null;
    return next;
    return;
  end if;

  insert into public.blocked_periods (starts_at, ends_at, reason, barber_id)
  values (v_starts_at, v_ends_at, v_reason, p_barber_id)
  returning id into blocked_period_id;

  return next;
end;
$function$;

revoke all on function private.create_blocked_period(timestamp without time zone, timestamp without time zone, text, uuid) from public, anon, authenticated;
grant execute on function private.create_blocked_period(timestamp without time zone, timestamp without time zone, text, uuid) to authenticated;

create function public.create_blocked_period(
  p_starts_at timestamp without time zone,
  p_ends_at timestamp without time zone,
  p_reason text default null,
  p_barber_id uuid default null
)
returns table(blocked_period_id uuid, conflicting_bookings jsonb)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select result.blocked_period_id, result.conflicting_bookings
  from private.create_blocked_period(p_starts_at, p_ends_at, p_reason, p_barber_id) as result;
$function$;

revoke all on function public.create_blocked_period(timestamp without time zone, timestamp without time zone, text, uuid) from public;
grant execute on function public.create_blocked_period(timestamp without time zone, timestamp without time zone, text, uuid) to authenticated;

notify pgrst, 'reload schema';
