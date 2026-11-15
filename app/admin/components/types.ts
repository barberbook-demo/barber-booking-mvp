export type Service = { id: string; name: string; price: number; active: boolean };
export type Booking = {
  id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  starts_at: string;
  status: "confirmed" | "cancelled";
  services: { name: string } | null;
};
export type BookingFilter = "all" | "today" | "upcoming" | "date";
export type BusinessDay = {
  weekday: number;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  break_start: string | null;
  break_end: string | null;
};


export type BlockedPeriod = { id: string; starts_at: string; ends_at: string; reason: string | null };
export type BookingConflict = { id: string; customer_name: string; service_name: string | null; starts_at: string };
