"use client";

import type { Booking, BookingFilter } from "./types";

type Props = {
  bookings: Booking[];
  visibleBookings: Booking[];
  bookingFilter: BookingFilter;
  bookingDate: string;
  busy: boolean;
  onFilterChange: (filter: BookingFilter) => void;
  onDateChange: (date: string) => void;
  onCancel: (booking: Booking) => void;
  formatDate: (value: string) => string;
  formatTime: (value: string) => string;
};

export default function BookingsTab({
  bookings, visibleBookings, bookingFilter, bookingDate, busy,
  onFilterChange, onDateChange, onCancel, formatDate, formatTime,
}: Props) {
  return (
    <section className="admin-panel" aria-labelledby="admin-bookings-heading">
      <div className="admin-section-heading">
        <div><p className="admin-eyebrow">01 / ΡΑΝΤΕΒΟΥ</p><h2 id="admin-bookings-heading">Ραντεβού πελατών</h2></div>
        <span>{bookings.length} συνολικά</span>
      </div>
      <div className="admin-booking-filters" role="group" aria-label="Φίλτρο ραντεβού">
        <button type="button" aria-pressed={bookingFilter === "all"} className={bookingFilter === "all" ? "admin-filter is-active" : "admin-filter"} onClick={() => onFilterChange("all")}>Όλα</button>
        <button type="button" aria-pressed={bookingFilter === "today"} className={bookingFilter === "today" ? "admin-filter is-active" : "admin-filter"} onClick={() => onFilterChange("today")}>Σήμερα</button>
        <button type="button" aria-pressed={bookingFilter === "upcoming"} className={bookingFilter === "upcoming" ? "admin-filter is-active" : "admin-filter"} onClick={() => onFilterChange("upcoming")}>Επερχόμενα</button>
        <button type="button" aria-pressed={bookingFilter === "date"} className={bookingFilter === "date" ? "admin-filter is-active" : "admin-filter"} onClick={() => onFilterChange("date")}>Ημερομηνία</button>
        {bookingFilter === "date" && <input aria-label="Επιλογή ημερομηνίας" type="date" value={bookingDate} onChange={(event) => onDateChange(event.target.value)} />}
      </div>
      {visibleBookings.length === 0 ? <p className="admin-muted">Δεν βρέθηκαν ραντεβού για αυτή την επιλογή.</p> : (
        <div className="admin-booking-list">
          {visibleBookings.map((booking) => (
            <article className="admin-booking-row" key={booking.id}>
              <div className="admin-booking-topline">
                <div>
                  <strong>{booking.customer_name}</strong>
                  <span className={booking.status === "confirmed" ? "admin-booking-status is-confirmed" : "admin-booking-status is-cancelled"}>{booking.status === "confirmed" ? "Επιβεβαιωμένο" : "Ακυρωμένο"}</span>
                </div>
                <div className="admin-booking-when"><strong>{formatDate(booking.starts_at)}</strong><span>{formatTime(booking.starts_at)}</span></div>
              </div>
              <div className="admin-booking-meta">
                <span><b>Υπηρεσία</b>{booking.services?.name ?? "Μη διαθέσιμη υπηρεσία"}</span>
                <span><b>Τηλέφωνο</b><a href={`tel:${booking.customer_phone}`}>{booking.customer_phone}</a></span>
                <span><b>Email</b><a href={`mailto:${booking.customer_email}`}>{booking.customer_email}</a></span>
              </div>
              {booking.status === "confirmed" && <div className="admin-booking-actions"><button className="admin-secondary" type="button" onClick={() => onCancel(booking)} disabled={busy}>Ακύρωση ραντεβού</button></div>}
            </article>
          ))}
        </div>
      )}
      <p className="admin-muted admin-booking-footnote">Οι ακυρωμένες κρατήσεις παραμένουν στο ιστορικό. Οι αλλαγές ενημερώνονται αυτόματα.</p>
    </section>
  );
}
