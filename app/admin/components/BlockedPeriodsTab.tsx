"use client";

import { useState, type FormEvent } from "react";
import type { BlockedPeriod, BookingConflict } from "./types";

type Props = {
  periods: BlockedPeriod[];
  conflicts: BookingConflict[];
  busy: boolean;
  today: string;
  onCreate: (startsAt: string, endsAt: string, reason: string) => Promise<boolean>;
  onDelete: (period: BlockedPeriod) => void;
  onDismissConflicts: () => void;
  formatDate: (value: string) => string;
  formatTime: (value: string) => string;
};

function nextLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

export default function BlockedPeriodsTab({
  periods, conflicts, busy, today, onCreate, onDelete, onDismissConflicts,
  formatDate, formatTime,
}: Props) {
  const [mode, setMode] = useState<"hours" | "days">("hours");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [reason, setReason] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startsAt = mode === "days" ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`;
    const endsAt = mode === "days"
      ? `${nextLocalDate(endDate)}T00:00:00`
      : `${endDate}T${endTime}:00`;
    if (startsAt >= endsAt) return;
    const saved = await onCreate(startsAt, endsAt, reason);
    if (saved) {
      setReason("");
      setStartDate(today);
      setEndDate(today);
    }
  }

  return (
    <>
      <section className="admin-panel" aria-labelledby="admin-blocked-heading">
        <div className="admin-section-heading">
          <div><p className="admin-eyebrow">03 / ΔΙΑΘΕΣΙΜΟΤΗΤΑ</p><h2 id="admin-blocked-heading">Αποκλεισμένες περίοδοι</h2></div>
          <span>{periods.length} καταχωρίσεις</span>
        </div>
        <p className="admin-muted admin-hours-intro">Δέσμευσε ώρες, ολόκληρες ημέρες ή πολυήμερες απουσίες. Οι αποκλεισμοί αφαιρούνται αυτόματα από τις διαθέσιμες ώρες.</p>

        <form className="admin-block-form" onSubmit={submit}>
          <div className="admin-block-mode" role="group" aria-label="Τύπος αποκλεισμού">
            <button type="button" className={mode === "hours" ? "admin-filter is-active" : "admin-filter"} aria-pressed={mode === "hours"} onClick={() => setMode("hours")}>Συγκεκριμένες ώρες</button>
            <button type="button" className={mode === "days" ? "admin-filter is-active" : "admin-filter"} aria-pressed={mode === "days"} onClick={() => setMode("days")}>Ολόκληρες ημέρες</button>
          </div>

          <div className="admin-block-fields">
            <label>Από ημερομηνία
              <input type="date" min={today} value={startDate} onChange={(event) => {
                setStartDate(event.target.value);
                if (event.target.value > endDate) setEndDate(event.target.value);
              }} required />
            </label>
            {mode === "hours" && <label>Ώρα έναρξης
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
            </label>}
            <label>Έως ημερομηνία
              <input type="date" min={startDate || today} value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
            </label>
            {mode === "hours" && <label>Ώρα λήξης
              <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
            </label>}
          </div>
          <label className="admin-block-reason">Αιτιολογία <span>(προαιρετική)</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={160} placeholder="π.χ. Άδεια, προσωπική υποχρέωση" />
          </label>
          {mode === "days" && <p className="admin-muted admin-block-hint">Η ημερομηνία λήξης συμπεριλαμβάνεται ολόκληρη. Η ζώνη ώρας είναι Europe/Athens.</p>}
          {mode === "hours" && startDate === endDate && startTime >= endTime && <p className="admin-error" role="alert">Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.</p>}
          <div className="admin-hours-footer">
            <p className="admin-muted">Αν υπάρχουν επιβεβαιωμένα ραντεβού στο διάστημα, θα εμφανιστούν για διευθέτηση και ο αποκλεισμός δεν θα αποθηκευτεί.</p>
            <button className="admin-primary" type="submit" disabled={busy || !startDate || !endDate || startDate > endDate || (mode === "hours" && startDate === endDate && startTime >= endTime)}>
              {busy ? "Έλεγχος…" : "Προσθήκη αποκλεισμού"}
            </button>
          </div>
        </form>

        {conflicts.length > 0 && (
          <div className="admin-block-conflicts" role="alert">
            <div className="admin-block-conflicts-heading">
              <strong>Δεν δημιουργήθηκε ο αποκλεισμός.</strong>
              <button type="button" className="admin-link-button" onClick={onDismissConflicts}>Κλείσιμο</button>
            </div>
            <p>Το διάστημα επικαλύπτεται με {conflicts.length} επιβεβαιωμένα ραντεβού. Διευθέτησέ τα πρώτα και δοκίμασε ξανά.</p>
            <ul>
              {conflicts.map((booking) => (
                <li key={booking.id}>
                  <strong>{booking.customer_name}</strong>
                  <span>{booking.service_name ?? "Ραντεβού"} · {formatDate(booking.starts_at)} · {formatTime(booking.starts_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="admin-panel" aria-labelledby="admin-blocked-list-heading">
        <div className="admin-section-heading">
          <div><p className="admin-eyebrow">ΙΣΧΥΟΝΤΕΣ ΑΠΟΚΛΕΙΣΜΟΙ</p><h2 id="admin-blocked-list-heading">Καταχωρισμένες περίοδοι</h2></div>
          <span>{periods.length} συνολικά</span>
        </div>
        {periods.length === 0 ? <p className="admin-muted">Δεν υπάρχουν καταχωρισμένοι αποκλεισμοί.</p> : (
          <div className="admin-block-list">
            {periods.map((period) => (
              <article className="admin-block-row" key={period.id}>
                <div className="admin-block-summary">
                  <strong>{formatDate(period.starts_at)}</strong>
                  <span>{formatTime(period.starts_at)} – {formatDate(period.ends_at)} · {formatTime(period.ends_at)}</span>
                  <small>{period.reason || "Χωρίς αιτιολογία"}</small>
                </div>
                <button type="button" className="admin-secondary" disabled={busy} onClick={() => onDelete(period)}>Αφαίρεση αποκλεισμού</button>
              </article>
            ))}
          </div>
        )}
        <p className="admin-muted admin-booking-footnote">Η αφαίρεση αποκλεισμού δεν επηρεάζει υπάρχουσες κρατήσεις.</p>
      </section>
    </>
  );
}
