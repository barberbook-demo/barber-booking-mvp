"use client";

import { useEffect, useState } from "react";

const services = [
  { id: "haircut", name: "Ανδρικό κούρεμα", price: 15 },
  { id: "haircut-beard", name: "Κούρεμα + μούσι", price: 20 },
  { id: "beard", name: "Περιποίηση γενειάδας", price: 10 },
] as const;

const timeSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];

type CustomerDetails = {
  name: string;
  phone: string;
  email: string;
};

function getAthensToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatBookingDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("el-GR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Athens",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [today, setToday] = useState("");
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [customer, setCustomer] = useState<CustomerDetails>({
    name: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    setToday(getAthensToday());
  }, []);

  const selectedService = services.find((service) => service.id === serviceId);

  function goBack() {
    setStep((current) => Math.max(1, current - 1));
  }

  function updateCustomer(field: keyof CustomerDetails, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep(5);
  }

  return (
    <main className="booking-page">
      <header className="site-header">
        <a className="brand" href="/" aria-label="BarberBook αρχική">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>BarberBook</span>
        </a>
        <span className="header-note">ONLINE BOOKING</span>
      </header>

      <section className="booking-shell">
        <div className="intro">
          <p className="eyebrow">ΤΟ ΕΠΟΜΕΝΟ ΣΟΥ ΡΑΝΤΕΒΟΥ</p>
          <h1>Κλείσε το ραντεβού σου.</h1>
          <p className="intro-copy">Επίλεξε υπηρεσία, ημέρα και ώρα. Είναι απλό και γρήγορο.</p>
        </div>

        {step < 5 && (
          <div className="progress-wrap" aria-label={`Βήμα ${step} από 4`}>
            <div className="progress-label">
              <span>Βήμα {step} από 4</span>
              <span>{Math.round((step / 4) * 100)}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-value" style={{ width: `${(step / 4) * 100}%` }} />
            </div>
            <div className="step-labels">
              <span className={step >= 1 ? "current" : ""}>Υπηρεσία</span>
              <span className={step >= 2 ? "current" : ""}>Ημερομηνία</span>
              <span className={step >= 3 ? "current" : ""}>Ώρα</span>
              <span className={step >= 4 ? "current" : ""}>Στοιχεία</span>
            </div>
          </div>
        )}

        <div className="booking-card">
          {step === 1 && (
            <section aria-labelledby="service-heading">
              <div className="section-kicker">01 / ΥΠΗΡΕΣΙΑ</div>
              <h2 id="service-heading">Τι θα κάνουμε σήμερα;</h2>
              <p className="section-copy">Επίλεξε την υπηρεσία που θέλεις.</p>

              <div className="service-list">
                {services.map((service) => (
                  <button
                    className={`service-option ${serviceId === service.id ? "selected" : ""}`}
                    type="button"
                    key={service.id}
                    onClick={() => setServiceId(service.id)}
                    aria-pressed={serviceId === service.id}
                  >
                    <span className="service-radio" aria-hidden="true">
                      {serviceId === service.id && <span />}
                    </span>
                    <span className="service-name">{service.name}</span>
                    <span className="service-price">{service.price} €</span>
                  </button>
                ))}
              </div>

              <button className="primary-button" type="button" disabled={!serviceId} onClick={() => setStep(2)}>
                Συνέχεια <span aria-hidden="true">→</span>
              </button>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="date-heading">
              <div className="section-kicker">02 / ΗΜΕΡΟΜΗΝΙΑ</div>
              <h2 id="date-heading">Ποια μέρα σε βολεύει;</h2>
              <p className="section-copy">Διάλεξε την ημέρα που θέλεις να επισκεφθείς το barber shop.</p>

              <label className="field-label" htmlFor="booking-date">Ημερομηνία ραντεβού</label>
              <input
                className="text-input date-input"
                id="booking-date"
                type="date"
                min={today || undefined}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setTime("");
                }}
                required
              />
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={goBack}>Πίσω</button>
                <button className="primary-button" type="button" disabled={!date || (today !== "" && date < today)} onClick={() => setStep(3)}>
                  Συνέχεια <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="time-heading">
              <div className="section-kicker">03 / ΩΡΑ</div>
              <h2 id="time-heading">Διάλεξε την ώρα σου.</h2>
              <p className="section-copy">{formatBookingDate(date)} · Όλα τα ραντεβού έχουν διάρκεια 30 λεπτών.</p>

              <div className="time-grid">
                {timeSlots.map((slot) => (
                  <button
                    className={`time-option ${time === slot ? "selected" : ""}`}
                    type="button"
                    key={slot}
                    onClick={() => setTime(slot)}
                    aria-pressed={time === slot}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              <p className="mock-note">Οι ώρες είναι ενδεικτικές και χρησιμοποιούν προσωρινά δεδομένα.</p>
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={goBack}>Πίσω</button>
                <button className="primary-button" type="button" disabled={!time} onClick={() => setStep(4)}>
                  Συνέχεια <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section aria-labelledby="details-heading">
              <div className="section-kicker">04 / ΣΤΟΙΧΕΙΑ</div>
              <h2 id="details-heading">Πώς σε λένε;</h2>
              <p className="section-copy">Συμπλήρωσε τα στοιχεία σου για να δεις την επιβεβαίωση.</p>

              <div className="summary-strip">
                <div>
                  <span>ΕΠΙΛΟΓΗ</span>
                  <strong>{selectedService?.name}</strong>
                </div>
                <div>
                  <span>ΗΜΕΡΟΜΗΝΙΑ & ΩΡΑ</span>
                  <strong>{formatBookingDate(date)} · {time}</strong>
                </div>
                <div>
                  <span>ΚΟΣΤΟΣ</span>
                  <strong>{selectedService?.price} €</strong>
                </div>
              </div>

              <form className="customer-form" onSubmit={handleSubmit}>
                <div className="form-field">
                  <label className="field-label" htmlFor="customer-name">Ονοματεπώνυμο</label>
                  <input
                    className="text-input"
                    id="customer-name"
                    type="text"
                    autoComplete="name"
                    placeholder="π.χ. Γιώργος Παπαδόπουλος"
                    value={customer.name}
                    onChange={(event) => updateCustomer("name", event.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="customer-phone">Τηλέφωνο</label>
                  <input
                    className="text-input"
                    id="customer-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="π.χ. 6912345678"
                    value={customer.phone}
                    onChange={(event) => updateCustomer("phone", event.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="customer-email">Email</label>
                  <input
                    className="text-input"
                    id="customer-email"
                    type="email"
                    autoComplete="email"
                    placeholder="π.χ. name@email.com"
                    value={customer.email}
                    onChange={(event) => updateCustomer("email", event.target.value)}
                    required
                  />
                </div>
                <p className="mock-note">Τα στοιχεία σου δεν αποστέλλονται ούτε αποθηκεύονται.</p>
                <div className="button-row">
                  <button className="secondary-button" type="button" onClick={goBack}>Πίσω</button>
                  <button className="primary-button" type="submit">
                    Συνέχεια <span aria-hidden="true">→</span>
                  </button>
                </div>
              </form>
            </section>
          )}

          {step === 5 && (
            <section className="confirmation" aria-labelledby="confirmation-heading">
              <div className="success-icon" aria-hidden="true">✓</div>
              <div className="section-kicker">05 / ΠΡΟΣΩΡΙΝΗ ΕΠΙΒΕΒΑΙΩΣΗ</div>
              <h2 id="confirmation-heading">Όλα έτοιμα, {customer.name.split(" ")[0]}!</h2>
              <p className="section-copy">Αυτή είναι μια δοκιμαστική σύνοψη των στοιχείων που επέλεξες.</p>

              <div className="confirmation-details">
                <div><span>Υπηρεσία</span><strong>{selectedService?.name}</strong></div>
                <div><span>Ημερομηνία</span><strong>{formatBookingDate(date)}</strong></div>
                <div><span>Ώρα</span><strong>{time}</strong></div>
                <div><span>Όνομα πελάτη</span><strong>{customer.name}</strong></div>
                <div className="confirmation-total"><span>Κόστος υπηρεσίας</span><strong>{selectedService?.price} €</strong></div>
              </div>

              <p className="demo-disclaimer">Δεν δημιουργήθηκε πραγματικό ραντεβού. Δεν έχει αποθηκευτεί κανένα στοιχείο.</p>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setStep(1);
                  setServiceId("");
                  setDate("");
                  setTime("");
                  setCustomer({ name: "", phone: "", email: "" });
                }}
              >
                Νέα δοκιμαστική κράτηση
              </button>
            </section>
          )}
        </div>

        <footer className="page-footer">
          <span>BarberBook</span>
          <span>Απλό. Γρήγορο. Στα μέτρα σου.</span>
        </footer>
      </section>
    </main>
  );
}
