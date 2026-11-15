-- The per-barber unique index and atomic booking RPC have been tested.
-- Remove the legacy shop-wide index so different barbers may be booked at the same time.
drop index public.bookings_one_confirmed_per_slot;
notify pgrst, 'reload schema';
