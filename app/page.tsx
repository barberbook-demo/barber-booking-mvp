"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Service = {
  id: string;
  name: string;
  price: number;
  active: boolean;
};

type Barber = { id: string; name: string; photo_path: string | null; photo_url: string | null };
type AvailableSlot = { slot_time: string };

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

function getWeekday(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [today, setToday] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [servicesRetry, setServicesRetry] = useState(0);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersLoading, setBarbersLoading] = useState(true);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [assignedBarberName, setAssignedBarberName] = useState("");
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState("");
  const [dateChecking, setDateChecking] = useState(false);
  const [dateError, setDateError] = useState("");
  const [time, setTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const dateCheckRequest = useRef(0);
  const [customer, setCustomer] = useState<CustomerDetails>({
    name: "",
    phone: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [bookingId, setBookingId] = useState("");

  useEffect(() => {
    setToday(getAthensToday());
  }, []);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    let cancelled = false;

    async function loadServices() {
      setServicesLoading(true);
      setBarbersLoading(true);
      setServicesError("");

      if (!supabaseUrl || !publishableKey) {
        setServicesError("Η σύνδεση με τις υπηρεσίες και τους κουρείς δεν έχει ρυθμιστεί ακόμη.");
        setServicesLoading(false);
        setBarbersLoading(false);
        return;
      }

      try {
        const supabase = createClient(supabaseUrl, publishableKey);
        const [{ data: serviceData, error: serviceError }, { data: barberData, error: barberError }] = await Promise.all([
          supabase.from("services").select("id, name, price, active").eq("active", true).order("name", { ascending: true }),
          supabase.from("barbers").select("id, name, photo_path").eq("is_active", true).order("sort_order").order("created_at"),
        ]);
        if (serviceError) throw serviceError;
        if (barberError) throw barberError;
        if (cancelled) return;
        setServices((serviceData ?? []).map((service) => ({ ...service, price: Number(service.price) })));
        const loadedBarbers = (barberData ?? []).map((barber) => ({
          ...barber,
          photo_url: barber.photo_path ? supabase.storage.from("barber-photos").getPublicUrl(barber.photo_path).data.publicUrl : null,
        }));
        setBarbers(loadedBarbers);
        setBarberId(loadedBarbers.length === 1 ? loadedBarbers[0].id : null);
      } catch {
        if (!cancelled) {
          setServicesError("Δεν ήταν δυνατή η φόρτωση των υπηρεσιών και των κουρέων. Έλεγξε τη σύνδεση και δοκίμασε ξανά.");
        }
      } finally {
        if (!cancelled) { setServicesLoading(false); setBarbersLoading(false); }
      }
    }

    void loadServices();

    return () => {
      cancelled = true;
    };
  }, [servicesRetry]);

  useEffect(() => {
    if (step !== 4 || !date) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    let cancelled = false;
    async function loadAvailability() {
      setAvailabilityLoading(true);
      setAvailabilityError("");
      setAvailableSlots([]);
      setTime("");
      if (!supabaseUrl || !publishableKey) {
        setAvailabilityError("Η σύνδεση με το σύστημα διαθεσιμότητας δεν έχει ρυθμιστεί ακόμη.");
        setAvailabilityLoading(false);
        return;
      }
      try {
        const supabase = createClient(supabaseUrl, publishableKey);
        const { data, error } = await supabase.rpc("get_available_slots", { p_date: date, p_barber_id: barberId });
        if (error) throw error;
        if (cancelled) return;
        const slots = (data ?? []) as AvailableSlot[];
        setAvailableSlots(slots.map((slot) => slot.slot_time.slice(0, 5)));
      } catch {
        if (!cancelled) setAvailabilityError("Δεν ήταν δυνατή η φόρτωση των διαθέσιμων ωρών. Δοκίμασε ξανά.");
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    }
    void loadAvailability();
    return () => { cancelled = true; };
  }, [step, date, barberId]);

  const selectedService = services.find((service) => service.id === serviceId);
  const selectedBarber = barbers.find((barber) => barber.id === barberId);

  function goBack() {
    setStep((current) => current === 3 && barbers.length === 1 ? 1 : Math.max(1, current - 1));
  }

  async function handleDateChange(value: string) {
    const requestId = ++dateCheckRequest.current;
    setDateError("");
    setTime("");
    setAvailableSlots([]);
    setAvailabilityError("");
    setDate(value);
    if (!value) { setDateChecking(false); return; }
    if (today && value < today) {
      setDate("");
      setDateError("Επίλεξε τη σημερινή ημερομηνία ή κάποια μελλοντική.");
      setDateChecking(false);
      return;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) {
      setDate("");
      setDateError("Δεν ήταν δυνατός ο έλεγχος του ωραρίου. Δοκίμασε ξανά.");
      setDateChecking(false);
      return;
    }
    setDateChecking(true);
    try {
      const supabase = createClient(supabaseUrl, publishableKey);
      const { data, error } = await supabase.from("business_hours").select("is_open").eq("weekday", getWeekday(value)).maybeSingle();
      if (requestId !== dateCheckRequest.current) return;
      if (error) throw error;
      if (!data?.is_open) {
        setDate("");
        setDateError("Το κατάστημα είναι κλειστό αυτή την ημέρα. Επίλεξε άλλη ημερομηνία.");
        return;
      }
      setDateError("");
    } catch {
      if (requestId === dateCheckRequest.current) {
        setDate("");
        setDateError("Δεν ήταν δυνατός ο έλεγχος του ωραρίου. Δοκίμασε ξανά.");
      }
    } finally {
      if (requestId === dateCheckRequest.current) setDateChecking(false);
    }
  }

  function updateCustomer(field: keyof CustomerDetails, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService || !date || !time || !availableSlots.includes(time)) {
      setSubmitError("Η επιλογή σου δεν είναι πλέον έγκυρη. Έλεγξε ξανά την ημερομηνία και την ώρα.");
      return;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) {
      setSubmitError("Δεν είναι διαθέσιμη αυτή τη στιγμή η υπηρεσία κρατήσεων. Δοκίμασε ξανά αργότερα.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const supabase = createClient(supabaseUrl, publishableKey);
      const { data, error } = await supabase.rpc("create_booking", {
        p_service_id: selectedService.id,
        p_date: date,
        p_time: time,
        p_customer_name: customer.name.trim(),
        p_customer_phone: customer.phone.trim(),
        p_customer_email: customer.email.trim(),
        p_barber_id: barberId,
      });
      if (error) {
        const message = error.message ?? "";
        if (message.includes("SLOT_UNAVAILABLE") || message.includes("bookings_one_confirmed_per_slot")) {
          setSubmitError("Η ώρα μόλις δεσμεύτηκε από άλλον πελάτη. Επίλεξε μία από τις νέες διαθέσιμες ώρες.");
        } else if (message.includes("BARBER_UNAVAILABLE")) {
          setSubmitError("Ο κουρέας δεν είναι πλέον διαθέσιμος. Επίλεξε ξανά κουρέα ή «Δεν έχω προτίμηση».");
        } else if (message.includes("SERVICE_UNAVAILABLE")) {
          setSubmitError("Η υπηρεσία δεν είναι πλέον διαθέσιμη. Επίλεξε ξανά υπηρεσία.");
        } else {
          setSubmitError("Δεν ήταν δυνατή η ολοκλήρωση της κράτησης. Έλεγξε τα στοιχεία σου και δοκίμασε ξανά.");
        }
        return;
      }
      const created = Array.isArray(data) ? data[0] : data;
      if (!created?.booking_id) {
        setSubmitError("Δεν λάβαμε επιβεβαίωση αποθήκευσης. Έλεγξε ξανά πριν επαναλάβεις την προσπάθεια.");
        return;
      }
      setBookingId(created.booking_id);
      setAssignedBarberName(barbers.find((barber) => barber.id === created.barber_id)?.name ?? "Κουρέας");
      setStep(6);
    } catch {
      setSubmitError("Παρουσιάστηκε προσωρινό πρόβλημα. Η κράτηση δεν επιβεβαιώθηκε· δοκίμασε ξανά.");
    } finally {
      setSubmitting(false);
    }
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

        {step < 6 && (
          <div className="progress-wrap" aria-label={`Βήμα ${step} από 5`}>
            <div className="progress-label">
              <span>Βήμα {step} από 5</span>
              <span>{Math.round((step / 5) * 100)}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-value" style={{ width: `${(step / 5) * 100}%` }} />
            </div>
            <div className="step-labels">
              <span className={step >= 1 ? "current" : ""}>Υπηρεσία</span>
              <span className={step >= 2 ? "current" : ""}>Κουρέας</span>
              <span className={step >= 3 ? "current" : ""}>Ημερομηνία</span>
              <span className={step >= 4 ? "current" : ""}>Ώρα</span>
              <span className={step >= 5 ? "current" : ""}>Στοιχεία</span>
            </div>
          </div>
        )}

        <div className="booking-card">
          {step === 1 && (
            <section aria-labelledby="service-heading">
              <div className="section-kicker">01 / ΥΠΗΡΕΣΙΑ</div>
              <h2 id="service-heading">Τι θα κάνουμε σήμερα;</h2>
              <p className="section-copy">Επίλεξε την υπηρεσία που θέλεις.</p>

              {servicesLoading ? (
                <p className="mock-note" role="status">Φόρτωση υπηρεσιών…</p>
              ) : servicesError ? (
                <div>
                  <p className="mock-note" role="alert">{servicesError}</p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setServicesRetry((attempt) => attempt + 1)}
                  >
                    Δοκίμασε ξανά
                  </button>
                </div>
              ) : services.length === 0 ? (
                <p className="mock-note">Δεν υπάρχουν διαθέσιμες υπηρεσίες αυτή τη στιγμή.</p>
              ) : (
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
              )}
              {!barbersLoading && !servicesError && barbers.length === 0 && <p className="mock-note" role="alert">Δεν υπάρχει ενεργός κουρέας για νέες κρατήσεις αυτή τη στιγμή.</p>}

              <button
                className="primary-button"
                type="button"
                disabled={servicesLoading || barbersLoading || Boolean(servicesError) || services.length === 0 || barbers.length === 0 || !serviceId}
                onClick={() => setStep(barbers.length > 1 ? 2 : 3)}
              >
                Συνέχεια <span aria-hidden="true">→</span>
              </button>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="barber-heading">
              <div className="section-kicker">02 / ΚΟΥΡΕΑΣ</div>
              <h2 id="barber-heading">Έχεις κάποια προτίμηση;</h2>
              <p className="section-copy">Επίλεξε τον κουρέα σου ή άφησε το σύστημα να βρει τον πρώτο διαθέσιμο.</p>
              <div className="barber-choice-list">
                {barbers.map((barber) => (
                  <button type="button" key={barber.id} className={barberId === barber.id ? "barber-option is-selected" : "barber-option"} aria-pressed={barberId === barber.id} onClick={() => setBarberId(barber.id)}>
                    <span className="barber-option-photo">{barber.photo_url ? <img src={barber.photo_url} alt="" /> : barber.name.slice(0, 1).toUpperCase()}</span>
                    <span>{barber.name}</span>
                    <span className="barber-option-check" aria-hidden="true">{barberId === barber.id ? "✓" : ""}</span>
                  </button>
                ))}
                <button type="button" className={barberId === null ? "barber-option is-selected" : "barber-option"} aria-pressed={barberId === null} onClick={() => setBarberId(null)}>
                  <span className="barber-option-photo barber-option-any">✦</span>
                  <span>Δεν έχω προτίμηση</span>
                  <span className="barber-option-check" aria-hidden="true">{barberId === null ? "✓" : ""}</span>
                </button>
              </div>
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={goBack}>Πίσω</button>
                <button className="primary-button" type="button" onClick={() => setStep(3)}>Συνέχεια <span aria-hidden="true">→</span></button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="date-heading">
              <div className="section-kicker">03 / ΗΜΕΡΟΜΗΝΙΑ</div>
              <h2 id="date-heading">Ποια μέρα σε βολεύει;</h2>
              <p className="section-copy">Διάλεξε την ημέρα που θέλεις να επισκεφθείς το barber shop.</p>

              <label className="field-label" htmlFor="booking-date">Ημερομηνία ραντεβού</label>
              <input
                className="text-input date-input"
                id="booking-date"
                type="date"
                min={today || undefined}
                value={date}
                onChange={(event) => void handleDateChange(event.target.value)}
                required
                aria-describedby={dateError ? "date-error" : undefined}
                aria-invalid={Boolean(dateError)}
              />
              {dateChecking && <p className="mock-note" role="status">Έλεγχος ωραρίου…</p>}
              {dateError && <p className="mock-note" id="date-error" role="alert">{dateError}</p>}
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={goBack}>Πίσω</button>
                <button className="primary-button" type="button" disabled={!date || dateChecking || Boolean(dateError) || (today !== "" && date < today)} onClick={() => setStep(4)}>
                  Συνέχεια <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section aria-labelledby="time-heading">
              <div className="section-kicker">04 / ΩΡΑ</div>
              <h2 id="time-heading">Διάλεξε την ώρα σου.</h2>
              <p className="section-copy">{formatBookingDate(date)} · Όλα τα ραντεβού έχουν διάρκεια 30 λεπτών.</p>

              {availabilityLoading ? (
                <p className="mock-note" role="status">Έλεγχος διαθέσιμων ωρών…</p>
              ) : availabilityError ? (
                <div>
                  <p className="mock-note" role="alert">{availabilityError}</p>
                  <button className="secondary-button" type="button" onClick={() => setStep(3)}>Επίλεξε ξανά ημερομηνία</button>
                </div>
              ) : availableSlots.length > 0 ? (
                <div className="time-grid">
                  {availableSlots.map((slot) => (
                    <button
                      className={"time-option " + (time === slot ? "selected" : "")}
                      type="button"
                      key={slot}
                      onClick={() => setTime(slot)}
                      aria-pressed={time === slot}
                    >{slot}</button>
                  ))}
                </div>
              ) : (
                <p className="mock-note" role="status">Δεν υπάρχουν διαθέσιμες ώρες για αυτή την ημέρα. Επίλεξε άλλη ημερομηνία ή επικοινώνησε με το κατάστημα.</p>
              )}
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={goBack}>Πίσω</button>
                <button className="primary-button" type="button" disabled={!time || availabilityLoading || Boolean(availabilityError) || !availableSlots.includes(time)} onClick={() => setStep(5)}>
                  Συνέχεια <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          )}

          {step === 5 && (
            <section aria-labelledby="details-heading">
              <div className="section-kicker">05 / ΣΤΟΙΧΕΙΑ</div>
              <h2 id="details-heading">Πώς σε λένε;</h2>
              <p className="section-copy">Συμπλήρωσε τα στοιχεία σου και επιβεβαίωσε το ραντεβού σου.</p>

              <div className="summary-strip">
                <div>
                  <span>ΕΠΙΛΟΓΗ</span>
                  <strong>{selectedService?.name}</strong>
                </div>
                <div>
                  <span>ΚΟΥΡΕΑΣ</span>
                  <strong>{selectedBarber?.name ?? "Χωρίς προτίμηση"}</strong>
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
                    maxLength={120}
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
                    maxLength={30}
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
                    maxLength={254}
                    required
                  />
                </div>
                <p className="mock-note">Τα στοιχεία σου αποθηκεύονται με ασφάλεια για τη διαχείριση του ραντεβού.</p>
                {submitError && <p className="admin-error" role="alert">{submitError}</p>}
                <div className="button-row">
                  <button className="secondary-button" type="button" onClick={goBack}>Πίσω</button>
                  <button className="primary-button" type="submit" disabled={submitting || !selectedService || !date || !time}>
                    {submitting ? "Αποθήκευση…" : "Επιβεβαίωση κράτησης"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {step === 6 && (
            <section className="confirmation" aria-labelledby="confirmation-heading">
              <div className="section-kicker">06 / ΕΠΙΒΕΒΑΙΩΣΗ</div>
              <h2 id="confirmation-heading">Το ραντεβού σου καταχωρήθηκε!</h2>
              <p className="section-copy">Η κράτησή σου αποθηκεύτηκε επιτυχώς στο BarberBook.</p>

              <div className="confirmation-details">
                <div><span>Υπηρεσία</span><strong>{selectedService?.name}</strong></div>
                <div><span>Ημερομηνία</span><strong>{formatBookingDate(date)}</strong></div>
                <div><span>Ώρα</span><strong>{time}</strong></div>
                <div><span>Κουρέας</span><strong>{assignedBarberName}</strong></div>
                <div><span>Όνομα πελάτη</span><strong>{customer.name}</strong></div>
                <div><span>Κωδικός κράτησης</span><strong>{bookingId.slice(0, 8).toUpperCase()}</strong></div>
                <div className="confirmation-total"><span>Κόστος υπηρεσίας</span><strong>{selectedService?.price} €</strong></div>
              </div>

              <p className="demo-disclaimer">Η ώρα σου έχει δεσμευτεί. Αν χρειαστείς αλλαγή ή ακύρωση, επικοινώνησε με το κατάστημα.</p>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setStep(1);
                  setBookingId("");
                  setAssignedBarberName("");
                  setSubmitError("");
                  setServiceId("");
                  setBarberId(barbers.length === 1 ? barbers[0].id : null);
                  setDate("");
                  setDateError("");
                  setTime("");
                  setAvailableSlots([]);
                  setCustomer({ name: "", phone: "", email: "" });
                }}
              >
                Νέα κράτηση
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
