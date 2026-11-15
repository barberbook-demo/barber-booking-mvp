
-- The shop schedule can begin at any wall-clock minute, but appointments are
-- always aligned to the common 30-minute grid. Barber opening times therefore
-- need not themselves be on :00 or :30.

alter table public.barber_business_hours
  drop constraint barber_hours_valid_schedule;

alter table public.barber_business_hours
  add constraint barber_hours_valid_schedule check (
    (is_open = false and opens_at is null and closes_at is null and break_start is null and break_end is null)
    or
    (is_open = true
      and opens_at is not null and closes_at is not null and opens_at < closes_at
      and ((break_start is null and break_end is null)
        or (break_start is not null and break_end is not null
          and break_start < break_end and break_start >= opens_at and break_end <= closes_at)))
  );

create or replace function private.get_available_slots(
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
    select h.opens_at, h.closes_at, h.break_start, h.break_end,
      date_trunc('hour', p_date::timestamp + h.opens_at)
      + (pg_catalog.ceil(extract(minute from (p_date::timestamp + h.opens_at)) / 30.0)::integer * interval '30 minutes')
      as first_slot
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
      sh.first_slot,
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

notify pgrst, 'reload schema';
