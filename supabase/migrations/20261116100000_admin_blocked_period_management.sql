-- Applied to Supabase project ssaaxoiryzjqexutmtms.
-- Administrator-managed blocked periods, conflict detection, and atomic booking serialization.

revoke all on table public.blocked_periods from public, anon, authenticated;
grant select, delete on table public.blocked_periods to authenticated;

drop policy if exists blocked_periods_admin_select on public.blocked_periods;
create policy blocked_periods_admin_select on public.blocked_periods for select to authenticated
using ((select private.is_barberbook_admin()));

drop policy if exists blocked_periods_admin_delete on public.blocked_periods;
create policy blocked_periods_admin_delete on public.blocked_periods for delete to authenticated
using ((select private.is_barberbook_admin()));

create or replace function private.get_available_slots(p_date date)
returns table(slot_time time without time zone)
language sql volatile security definer set search_path = ''
as $function$
  with day_hours as (
    select h.opens_at, h.closes_at, h.break_start, h.break_end
    from public.business_hours as h
    where h.weekday = extract(dow from p_date)::smallint and h.is_open = true
  ),
  candidate_slots as (
    select generated.local_start,
      generated.local_start at time zone 'Europe/Athens' as starts_at,
      h.break_start, h.break_end
    from day_hours as h
    cross join lateral pg_catalog.generate_series(
      p_date::timestamp + h.opens_at,
      p_date::timestamp + h.closes_at - interval '30 minutes',
      interval '30 minutes'
    ) as generated(local_start)
  )
  select c.local_start::time as slot_time
  from candidate_slots as c
  where c.starts_at > pg_catalog.now()
    and (c.starts_at at time zone 'Europe/Athens') = c.local_start
    and not (c.break_start is not null
      and c.local_start < p_date::timestamp + c.break_end
      and c.local_start + interval '30 minutes' > p_date::timestamp + c.break_start)
    and not exists (
      select 1 from public.bookings as b
      where b.status = 'confirmed'
        and b.starts_at < c.starts_at + interval '30 minutes'
        and b.starts_at + interval '30 minutes' > c.starts_at
    )
    and not exists (
      select 1 from public.blocked_periods as bp
      where bp.starts_at < c.starts_at + interval '30 minutes'
        and bp.ends_at > c.starts_at
    )
  order by c.local_start;
$function$;

create or replace function private.create_booking(
  p_service_id uuid, p_date date, p_time time without time zone,
  p_customer_name text, p_customer_phone text, p_customer_email text
)
returns table(booking_id uuid, starts_at timestamptz)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_starts_at timestamptz;
  v_name text;
  v_phone text;
  v_email text;
  v_active boolean;
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('barberbook:schedule_mutation'), 1);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_starts_at::text, 0));
  select s.active into v_active from public.services as s where s.id = p_service_id for share;
  if not coalesce(v_active, false) then
    raise exception using errcode = 'P0001', message = 'SERVICE_UNAVAILABLE';
  end if;
  if not exists (select 1 from private.get_available_slots(p_date) as slot where slot.slot_time = p_time) then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end if;
  insert into public.bookings (service_id, customer_name, customer_phone, customer_email, starts_at, status)
  values (p_service_id, v_name, v_phone, v_email, v_starts_at, 'confirmed')
  returning id, public.bookings.starts_at into booking_id, starts_at;
  return next;
end;
$function$;

create or replace function private.create_blocked_period(
  p_starts_at timestamp without time zone,
  p_ends_at timestamp without time zone,
  p_reason text default null
)
returns table(blocked_period_id uuid, conflicting_bookings jsonb)
language plpgsql volatile security definer set search_path = ''
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
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', b.id, 'customer_name', b.customer_name,
      'service_name', s.name, 'starts_at', b.starts_at
    ) order by b.starts_at
  ), '[]'::jsonb)
  into conflicting_bookings
  from public.bookings as b
  left join public.services as s on s.id = b.service_id
  where b.status = 'confirmed'
    and b.starts_at < v_ends_at
    and b.starts_at + interval '30 minutes' > v_starts_at;

  if pg_catalog.jsonb_array_length(conflicting_bookings) > 0 then
    blocked_period_id := null;
    return next;
    return;
  end if;
  insert into public.blocked_periods (starts_at, ends_at, reason)
  values (v_starts_at, v_ends_at, v_reason)
  returning id into blocked_period_id;
  return next;
end;
$function$;

revoke all on function private.create_blocked_period(timestamp without time zone, timestamp without time zone, text) from public, anon, authenticated;
grant execute on function private.create_blocked_period(timestamp without time zone, timestamp without time zone, text) to authenticated;

create or replace function public.create_blocked_period(
  p_starts_at timestamp without time zone,
  p_ends_at timestamp without time zone,
  p_reason text default null
)
returns table(blocked_period_id uuid, conflicting_bookings jsonb)
language sql volatile security invoker set search_path = ''
as $function$
  select result.blocked_period_id, result.conflicting_bookings
  from private.create_blocked_period(p_starts_at, p_ends_at, p_reason) as result;
$function$;
revoke all on function public.create_blocked_period(timestamp without time zone, timestamp without time zone, text) from public, anon;
grant execute on function public.create_blocked_period(timestamp without time zone, timestamp without time zone, text) to authenticated;
