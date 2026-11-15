"use client";

import type { FormEvent } from "react";
import type { Service } from "./types";

type Props = {
  services: Service[];
  newName: string;
  newPrice: string;
  busy: boolean;
  onServiceChange: (service: Service) => void;
  onAdd: (event: FormEvent<HTMLFormElement>) => void;
  onNewNameChange: (value: string) => void;
  onNewPriceChange: (value: string) => void;
  onSave: (service: Service) => void;
  onToggle: (service: Service) => void;
};

export default function ServicesTab({
  services, newName, newPrice, busy, onServiceChange, onAdd,
  onNewNameChange, onNewPriceChange, onSave, onToggle,
}: Props) {
  return (
    <section className="admin-panel" aria-labelledby="admin-services-heading">
      <div className="admin-section-heading">
        <div><p className="admin-eyebrow">01 / ΚΑΤΑΛΟΓΟΣ</p><h2 id="admin-services-heading">Υπηρεσίες και τιμές</h2></div>
        <span>{services.length} υπηρεσίες</span>
      </div>
      <div className="admin-service-list">
        {services.map((service) => (
          <div className="admin-service-row" key={service.id}>
            <div className="admin-service-fields">
              <label>Ονομασία
                <input value={service.name} onChange={(event) => onServiceChange({ ...service, name: event.target.value })} />
              </label>
              <label>Τιμή (€)
                <input type="number" min="0" step="0.01" value={service.price} onChange={(event) => onServiceChange({ ...service, price: Number(event.target.value) })} />
              </label>
            </div>
            <div className="admin-service-actions">
              <span className={service.active ? "admin-status is-active" : "admin-status"}>{service.active ? "Ενεργή" : "Ανενεργή"}</span>
              <button className="admin-secondary" type="button" onClick={() => onSave(service)} disabled={busy}>Αποθήκευση</button>
              <button className="admin-link-button" type="button" onClick={() => onToggle(service)} disabled={busy}>{service.active ? "Απενεργοποίηση" : "Ενεργοποίηση"}</button>
            </div>
          </div>
        ))}
        {services.length === 0 && <p className="admin-muted">Δεν έχουν προστεθεί υπηρεσίες.</p>}
      </div>
      <form className="admin-add-service" onSubmit={onAdd}>
        <h3>Προσθήκη υπηρεσίας</h3>
        <div className="admin-add-fields">
          <label>Ονομασία
            <input value={newName} onChange={(event) => onNewNameChange(event.target.value)} placeholder="π.χ. Ανδρικό κούρεμα" required />
          </label>
          <label>Τιμή (€)
            <input type="number" min="0" step="0.01" value={newPrice} onChange={(event) => onNewPriceChange(event.target.value)} required />
          </label>
          <button className="admin-primary" type="submit" disabled={busy}>Προσθήκη</button>
        </div>
      </form>
    </section>
  );
}
