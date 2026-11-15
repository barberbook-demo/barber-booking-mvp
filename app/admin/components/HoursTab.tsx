"use client";

import type { FormEvent } from "react";
import type { BusinessDay } from "./types";

const WEEKDAYS = [
  { value: 1, label: "Δευτέρα" },
  { value: 2, label: "Τρίτη" },
  { value: 3, label: "Τετάρτη" },
  { value: 4, label: "Πέμπτη" },
  { value: 5, label: "Παρασκευή" },
  { value: 6, label: "Σάββατο" },
  { value: 0, label: "Κυριακή" },
];
const EMPTY_HOURS: BusinessDay[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday, is_open: false, opens_at: null, closes_at: null, break_start: null, break_end: null,
}));

type Props = {
  hours: BusinessDay[];
  busy: boolean;
  onDayChange: (weekday: number, changes: Partial<BusinessDay>) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
};

export default function HoursTab({ hours, busy, onDayChange, onSave }: Props) {
  return (
    <>
      <section className="admin-panel" aria-labelledby="admin-hours-heading">
        <div className="admin-section-heading">
          <div><p className="admin-eyebrow">02 / ΠΡΟΓΡΑΜΜΑ</p><h2 id="admin-hours-heading">Εβδομαδιαίο ωράριο</h2></div>
          <span>Ώρα Ελλάδας · Europe/Athens</span>
        </div>
        <p className="admin-muted admin-hours-intro">Επίλεξε τις ημέρες λειτουργίας, τις ώρες έναρξης και λήξης και, αν χρειάζεται, ένα διάλειμμα.</p>
        <form onSubmit={onSave}>
          <div className="admin-hours-list">
            {WEEKDAYS.map((weekday) => {
              const day = hours.find((item) => item.weekday === weekday.value) ?? EMPTY_HOURS[weekday.value];
              return (
                <div className={day.is_open ? "admin-day-row is-open" : "admin-day-row"} key={weekday.value}>
                  <div className="admin-day-toggle">
                    <label className="admin-switch">
                      <input type="checkbox" checked={day.is_open} onChange={(event) => onDayChange(weekday.value, { is_open: event.target.checked })} />
                      <span aria-hidden="true" />
                    </label>
                    <strong>{weekday.label}</strong>
                  </div>
                  {day.is_open ? (
                    <div className="admin-day-times">
                      <label>Από<input type="time" value={day.opens_at ?? ""} onChange={(event) => onDayChange(weekday.value, { opens_at: event.target.value })} required /></label>
                      <label>Έως<input type="time" value={day.closes_at ?? ""} onChange={(event) => onDayChange(weekday.value, { closes_at: event.target.value })} required /></label>
                      <label>Διάλειμμα από<input type="time" value={day.break_start ?? ""} onChange={(event) => onDayChange(weekday.value, { break_start: event.target.value || null })} /></label>
                      <label>Διάλειμμα έως<input type="time" value={day.break_end ?? ""} onChange={(event) => onDayChange(weekday.value, { break_end: event.target.value || null })} /></label>
                    </div>
                  ) : <span className="admin-closed-label">Κλειστά</span>}
                </div>
              );
            })}
          </div>
          <div className="admin-hours-footer">
            <p className="admin-muted">Το ωράριο αποθηκεύεται για κάθε ημέρα ξεχωριστά.</p>
            <button className="admin-primary" type="submit" disabled={busy}>{busy ? "Αποθήκευση…" : "Αποθήκευση ωραρίου"}</button>
          </div>
        </form>
      </section>
      <p className="admin-footer-note">Το ωράριο και οι υπηρεσίες χρησιμοποιούνται απευθείας στη δημόσια διαδικασία κρατήσεων.</p>
    </>
  );
}
