-- Return only free 30-minute local appointment times for one date.
-- The SECURITY DEFINER boundary is intentionally narrow: the function reads
-- private booking data internally but never returns booking/customer records.
-- Direct SELECT access and all existing RLS policies remain unchanged.

create or replace function public.get_available_slots(p_date date)
returns table(slot_time time without time zone)
language sql
stable
security definer
set search_path = ''
as $function$
  with day_hours as (
    select h.opens_at, h.closes_at, h.break_start, h.break_end
    from public.business_hours as h
    where h.weekday = extract(dow from p_date)::smallint
      and h.is_open = true
  ),
  candidate_slots as (
    select
      generated.local_start,
      generated.local_start at time zone 'Europe/Athens' as starts_at,
      h.break_start,
      h.break_end
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
    -- Exclude nonexistent local times during the spring DST transition.
    and (c.starts_at at time zone 'Europe/Athens') = c.local_start
    -- Breaks and appointments use half-open interval overlap checks.
    and not (
      c.break_start is not null
      and c.local_start < p_date::timestamp + c.break_end
      and c.local_start + interval '30 minutes' > p_date::timestamp + c.break_start
    )
    and not exists (
      select 1
      from public.bookings as b
      where b.status = 'confirmed'
        and b.starts_at < c.starts_at + interval '30 minutes'
        and b.starts_at + interval '30 minutes' > c.starts_at
    )
    and not exists (
      select 1
      from public.blocked_periods as bp
      where bp.starts_at < c.starts_at + interval '30 minutes'
        and bp.ends_at > c.starts_at
    )
  order by c.local_start;
$function$;

revoke all on function public.get_available_slots(date) from public;
revoke all on function public.get_available_slots(date) from anon, authenticated;
grant execute on function public.get_available_slots(date) to anon, authenticated;
