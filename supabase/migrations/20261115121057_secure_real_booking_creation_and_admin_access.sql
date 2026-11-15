-- Secure real booking creation and administrator-only booking management.
alter table private.admin_config enable row level security;

revoke all on table public.bookings from public, anon, authenticated;
grant select on table public.bookings to authenticated;
grant update (status) on table public.bookings to authenticated;

drop policy if exists bookings_admin_select on public.bookings;
create policy bookings_admin_select
on public.bookings for select to authenticated
using ((select private.is_barberbook_admin()));

drop policy if exists bookings_admin_cancel on public.bookings;
create policy bookings_admin_cancel
on public.bookings for update to authenticated
using ((select private.is_barberbook_admin()) and status = 'confirmed')
with check ((select private.is_barberbook_admin()) and status = 'cancelled');

create or replace function private.create_booking(
  p_service_id uuid, p_date date, p_time time without time zone,
  p_customer_name text, p_customer_phone text, p_customer_email text
)
returns table (booking_id uuid, starts_at timestamptz)
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
     or v_email !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9]([A-Z0-9-]{0,61}[A-Z0-9])?([.][A-Z0-9]([A-Z0-9-]{0,61}[A-Z0-9])?)+$' then
    raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_DETAILS';
  end if;

  v_starts_at := (p_date::timestamp + p_time) at time zone 'Europe/Athens';
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_starts_at::text, 0));

  select s.active into v_active
  from public.services as s where s.id = p_service_id
  for share;
  if not coalesce(v_active, false) then
    raise exception using errcode = 'P0001', message = 'SERVICE_UNAVAILABLE';
  end if;

  if not exists (
    select 1 from private.get_available_slots(p_date) as slot
    where slot.slot_time = p_time
  ) then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end if;

  insert into public.bookings (
    service_id, customer_name, customer_phone, customer_email, starts_at, status
  ) values (
    p_service_id, v_name, v_phone, v_email, v_starts_at, 'confirmed'
  )
  returning id, public.bookings.starts_at into booking_id, starts_at;
  return next;
end;
$function$;

revoke all on function private.create_booking(uuid, date, time, text, text, text) from public, anon, authenticated;
grant execute on function private.create_booking(uuid, date, time, text, text, text) to anon, authenticated;

create or replace function public.create_booking(
  p_service_id uuid, p_date date, p_time time without time zone,
  p_customer_name text, p_customer_phone text, p_customer_email text
)
returns table (booking_id uuid, starts_at timestamptz)
language sql security invoker set search_path = ''
as $function$
  select created.booking_id, created.starts_at
  from private.create_booking(
    p_service_id, p_date, p_time, p_customer_name, p_customer_phone, p_customer_email
  ) as created;
$function$;

revoke all on function public.create_booking(uuid, date, time, text, text, text) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, date, time, text, text, text) to anon, authenticated;

alter publication supabase_realtime add table public.bookings;
