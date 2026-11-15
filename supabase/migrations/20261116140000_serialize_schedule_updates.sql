
-- Serialize changes to store hours, barber hours and barber activation with
-- booking/block creation, so a concurrent booking cannot rely on stale schedule state.
create or replace function private.lock_schedule_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('barberbook:schedule_mutation'), 1);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

revoke all on function private.lock_schedule_mutation() from public, anon, authenticated;

drop trigger if exists business_hours_schedule_lock on public.business_hours;
create trigger business_hours_schedule_lock
before insert or update or delete on public.business_hours
for each row execute function private.lock_schedule_mutation();

drop trigger if exists barber_business_hours_schedule_lock on public.barber_business_hours;
create trigger barber_business_hours_schedule_lock
before insert or update or delete on public.barber_business_hours
for each row execute function private.lock_schedule_mutation();

drop trigger if exists barbers_schedule_lock on public.barbers;
create trigger barbers_schedule_lock
before insert or update or delete on public.barbers
for each row execute function private.lock_schedule_mutation();
