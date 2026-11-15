create or replace function public.prevent_booking_in_blocked_period()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.status = 'confirmed' and exists (
    select 1
    from public.blocked_periods as bp
    where new.starts_at < bp.ends_at
      and new.starts_at + interval '30 minutes' > bp.starts_at
  ) then
    raise exception 'Booking slot overlaps a blocked period';
  end if;
  return new;
end;
$function$;