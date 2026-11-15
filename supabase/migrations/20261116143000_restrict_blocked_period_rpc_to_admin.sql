-- Tighten explicit function grants because this project has role-specific default EXECUTE grants.
revoke all on function public.create_blocked_period(timestamp without time zone, timestamp without time zone, text, uuid) from public, anon;
grant execute on function public.create_blocked_period(timestamp without time zone, timestamp without time zone, text, uuid) to authenticated;

revoke all on function private.create_blocked_period(timestamp without time zone, timestamp without time zone, text, uuid) from public, anon;
grant execute on function private.create_blocked_period(timestamp without time zone, timestamp without time zone, text, uuid) to authenticated;
