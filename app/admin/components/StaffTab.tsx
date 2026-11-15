"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Barber, BusinessDay } from "./types";

const WEEKDAYS = [
  { value: 1, label: "Δευτέρα" },
  { value: 2, label: "Τρίτη" },
  { value: 3, label: "Τετάρτη" },
  { value: 4, label: "Πέμπτη" },
  { value: 5, label: "Παρασκευή" },
  { value: 6, label: "Σάββατο" },
  { value: 0, label: "Κυριακή" },
];

type Props = {
  barbers: Barber[];
  selectedBarberId: string;
  hours: BusinessDay[];
  busy: boolean;
  photoUrl: string | null;
  onSelectBarber: (id: string) => void;
  onAdd: (name: string) => Promise<boolean>;
  onRename: (barber: Barber, name: string) => Promise<boolean>;
  onToggle: (barber: Barber) => void;
  onPhotoUpload: (barber: Barber, file: File) => void;
  onPhotoRemove: (barber: Barber) => void;
  onDayChange: (weekday: number, changes: Partial<BusinessDay>) => void;
  onSaveHours: (event: FormEvent<HTMLFormElement>) => void;
};

export default function StaffTab({
  barbers, selectedBarberId, hours, busy, photoUrl, onSelectBarber, onAdd, onRename,
  onToggle, onPhotoUpload, onPhotoRemove, onDayChange, onSaveHours,
}: Props) {
  const [newName, setNewName] = useState("");
  const selected = barbers.find((barber) => barber.id === selectedBarberId) ?? null;
  const [draftName, setDraftName] = useState(selected?.name ?? "");

  useEffect(() => {
    setDraftName(selected?.name ?? "");
  }, [selected?.id, selected?.name]);

  async function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onAdd(newName)) setNewName("");
  }

  async function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected) await onRename(selected, draftName);
  }

  return (
    <>
      <section className="admin-panel" aria-labelledby="admin-staff-heading">
        <div className="admin-section-heading">
          <div><p className="admin-eyebrow">04 / ΟΜΑΔΑ</p><h2 id="admin-staff-heading">Προσωπικό</h2></div>
          <span>{barbers.filter((barber) => barber.is_active).length} ενεργοί</span>
        </div>
        <p className="admin-muted admin-hours-intro">Διαχειρίσου τους κουρείς του καταστήματος. Η απενεργοποίηση σταματά τις νέες κρατήσεις, χωρίς να διαγράφει το ιστορικό.</p>

        <form className="admin-staff-add" onSubmit={submitNew}>
          <label htmlFor="admin-new-barber">Προσθήκη κουρέα</label>
          <div>
            <input id="admin-new-barber" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={100} placeholder="Ονοματεπώνυμο κουρέα" required />
            <button className="admin-primary" type="submit" disabled={busy || newName.trim().length < 2}>Προσθήκη</button>
          </div>
          <p className="admin-muted">Το νέο προφίλ ξεκινά με το τρέχον ωράριο καταστήματος. Μπορείς να το προσαρμόσεις παρακάτω.</p>
        </form>

        {barbers.length === 0 ? <p className="admin-muted">Δεν υπάρχουν καταχωρισμένοι κουρείς.</p> : (
          <div className="admin-staff-list">
            {barbers.map((barber) => (
              <button key={barber.id} type="button" className={barber.id === selectedBarberId ? "admin-staff-choice is-selected" : "admin-staff-choice"} onClick={() => onSelectBarber(barber.id)} aria-pressed={barber.id === selectedBarberId}>
                <span className="admin-staff-avatar">{barber.id === selectedBarberId && photoUrl ? <img src={photoUrl} alt="" /> : barber.name.slice(0, 1).toUpperCase()}</span>
                <span><strong>{barber.name}</strong><small>{barber.is_active ? "Ενεργός" : "Ανενεργός"}</small></span>
                <span className="admin-staff-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <>
          <section className="admin-panel" aria-labelledby="admin-barber-profile-heading">
            <div className="admin-section-heading">
              <div><p className="admin-eyebrow">ΠΡΟΦΙΛ ΚΟΥΡΕΑ</p><h2 id="admin-barber-profile-heading">{selected.name}</h2></div>
              <span className={selected.is_active ? "admin-booking-status is-confirmed" : "admin-booking-status is-cancelled"}>{selected.is_active ? "Ενεργός" : "Ανενεργός"}</span>
            </div>
            <div className="admin-staff-profile">
              <div className="admin-staff-photo">
                {photoUrl ? <img src={photoUrl} alt={`Φωτογραφία ${selected.name}`} /> : <span>{selected.name.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="admin-staff-profile-actions">
                <label className="admin-secondary admin-upload-button">
                  {selected.photo_path ? "Αλλαγή φωτογραφίας" : "Προσθήκη φωτογραφίας"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onPhotoUpload(selected, file);
                    event.currentTarget.value = "";
                  }} />
                </label>
                {selected.photo_path && <button type="button" className="admin-link-button" disabled={busy} onClick={() => onPhotoRemove(selected)}>Αφαίρεση φωτογραφίας</button>}
                <small>JPG, PNG ή WebP · έως 3 MB</small>
              </div>
            </div>
            <form className="admin-staff-name-form" onSubmit={submitName}>
              <label htmlFor="admin-barber-name">Όνομα κουρέα</label>
              <div>
                <input id="admin-barber-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={100} required />
                <button className="admin-primary" type="submit" disabled={busy || draftName.trim().length < 2 || draftName.trim() === selected.name}>Αποθήκευση ονόματος</button>
              </div>
            </form>
            <div className="admin-hours-footer">
              <p className="admin-muted">Οι παλιές και μελλοντικές κρατήσεις παραμένουν συνδεδεμένες με αυτό το προφίλ.</p>
              <button type="button" className="admin-secondary" disabled={busy} onClick={() => onToggle(selected)}>{selected.is_active ? "Απενεργοποίηση κουρέα" : "Ενεργοποίηση κουρέα"}</button>
            </div>
          </section>

          <section className="admin-panel" aria-labelledby="admin-barber-hours-heading">
            <div className="admin-section-heading">
              <div><p className="admin-eyebrow">ΑΤΟΜΙΚΟ ΠΡΟΓΡΑΜΜΑ</p><h2 id="admin-barber-hours-heading">Ωράριο · {selected.name}</h2></div>
              <span>Ώρα Ελλάδας · Europe/Athens</span>
            </div>
            <p className="admin-muted admin-hours-intro">Η διαθεσιμότητα είναι πάντα η τομή του ωραρίου αυτού και του γενικού ωραρίου του καταστήματος.</p>
            <form onSubmit={onSaveHours}>
              <div className="admin-hours-list">
                {WEEKDAYS.map((weekday) => {
                  const day = hours.find((item) => item.weekday === weekday.value) ?? {
                    weekday: weekday.value, is_open: false, opens_at: null, closes_at: null, break_start: null, break_end: null,
                  };
                  return (
                    <div className={day.is_open ? "admin-day-row is-open" : "admin-day-row"} key={weekday.value}>
                      <div className="admin-day-toggle">
                        <label className="admin-switch">
                          <input type="checkbox" checked={day.is_open} onChange={(event) => onDayChange(weekday.value, { is_open: event.target.checked, opens_at: event.target.checked ? (day.opens_at ?? "10:00") : null, closes_at: event.target.checked ? (day.closes_at ?? "11:00") : null, break_start: event.target.checked ? day.break_start : null, break_end: event.target.checked ? day.break_end : null })} />
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
                <p className="admin-muted">Το ωράριο του κουρέα δεν μπορεί να επεκτείνει το ωράριο του καταστήματος.</p>
                <button className="admin-primary" type="submit" disabled={busy}>{busy ? "Αποθήκευση…" : "Αποθήκευση ατομικού ωραρίου"}</button>
              </div>
            </form>
          </section>
        </>
      )}
    </>
  );
}
