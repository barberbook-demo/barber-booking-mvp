-- Allow public booking clients to request the safe availability result.
-- The private schema is not exposed by the Supabase Data API.

grant usage on schema private to anon, authenticated;
grant execute on function private.get_available_slots(date) to anon, authenticated;
grant execute on function public.get_available_slots(date) to anon, authenticated;
