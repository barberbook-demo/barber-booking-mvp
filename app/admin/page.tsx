"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import BookingsTab from "./components/BookingsTab";
import ServicesTab from "./components/ServicesTab";
import HoursTab from "./components/HoursTab";
import type { Booking, BookingFilter, BusinessDay, Service } from "./components/types";

type AuthState = "loading" | "signed_out" | "checking" | "authorized" | "unauthorized" | "error";

const EMPTY_HOURS: BusinessDay[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  is_open: false,
  opens_at: null,
  closes_at: null,
  break_start: null,
  break_end: null,
}));

function timeValue(value: string | null) {
  return value ? value.slice(0, 5) : "";
}
function athensDate(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
function formatAdminTime(value: string) {
  return new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

export default function AdminPage() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? createClient(url, key) : null;
  }, []);

  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<BusinessDay[]>(EMPTY_HOURS);
  const [dataError, setDataError] = useState("");
  const [notice, setNotice] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
  const [bookingDate, setBookingDate] = useState(athensDate(new Date()));
  const [activeTab, setActiveTab] = useState<"appointments" | "management">("appointments");
  const [managementTab, setManagementTab] = useState<"services" | "hours">("services");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("15");

  useEffect(() => {
    if (!supabase) {
      setAuthState("error");
      setLoginError("Δεν έχουν ρυθμιστεί τα στοιχεία σύνδεσης με τη Supabase.");
      setAuthReady(true);
      return;
    }

    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setLoginError("Δεν ήταν δυνατός ο έλεγχος της σύνδεσης. Δοκίμασε ξανά.");
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!authReady || !supabase) return;
    if (!userId) {
      setAuthState("signed_out");
      setServices([]);
      setHours(EMPTY_HOURS);
      return;
    }

    let cancelled = false;
    async function verifyAndLoad() {
      setAuthState("checking");
      setDataError("");
      const { data: isAdmin, error: authError } = await supabase!.rpc("is_barberbook_admin");
      if (cancelled) return;
      if (authError) {
        setAuthState("error");
        setDataError("Δεν ήταν δυνατός ο έλεγχος δικαιωμάτων. Έλεγξε τη ρύθμιση διαχειριστή.");
        return;
      }
      if (isAdmin !== true) {
        setAuthState("unauthorized");
        return;
      }

      const [serviceResult, hoursResult, bookingResult] = await Promise.all([
        supabase!.from("services").select("id, name, price, active").order("name"),
        supabase!.from("business_hours").select("weekday, is_open, opens_at, closes_at, break_start, break_end").order("weekday"),
        supabase!.from("bookings").select("id, service_id, customer_name, customer_phone, customer_email, starts_at, status, services(name)").order("starts_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (serviceResult.error || hoursResult.error || bookingResult.error) {
        setAuthState("error");
        setDataError("Δεν ήταν δυνατή η φόρτωση των ρυθμίσεων. Δοκίμασε ξανά.");
        return;
      }

      setServices((serviceResult.data ?? []).map((item) => ({
        ...item,
        price: Number(item.price),
      })));
      setBookings((bookingResult.data ?? []) as unknown as Booking[]);
      const savedHours = new Map((hoursResult.data ?? []).map((day) => [day.weekday, day]));
      setHours(EMPTY_HOURS.map((day) => {
        const saved = savedHours.get(day.weekday);
        return saved ? {
          ...saved,
          opens_at: timeValue(saved.opens_at),
          closes_at: timeValue(saved.closes_at),
          break_start: timeValue(saved.break_start),
          break_end: timeValue(saved.break_end),
        } : day;
      }));
      setAuthState("authorized");
    }

    void verifyAndLoad();
    return () => { cancelled = true; };
  }, [authReady, userId, supabase]);

  useEffect(() => {
    if (authState !== "authorized" || !supabase) return;
    const channel = supabase.channel("barberbook-admin-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        void supabase.from("bookings")
          .select("id, service_id, customer_name, customer_phone, customer_email, starts_at, status, services(name)")
          .order("starts_at", { ascending: false })
          .then(({ data }) => { if (data) setBookings(data as unknown as Booking[]); });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [authState, supabase]);

  async function cancelBooking(booking: Booking) {
    if (!supabase || booking.status !== "confirmed") return;
    const appointment = `${formatAdminDate(booking.starts_at)} στις ${formatAdminTime(booking.starts_at)}`;
    if (!window.confirm(`Να ακυρωθεί το ραντεβού ${appointment} για τον/την ${booking.customer_name};`)) return;
    setBusy(true);
    setDataError("");
    const { data, error } = await supabase.from("bookings")
      .update({ status: "cancelled" }).eq("id", booking.id).eq("status", "confirmed")
      .select("id").maybeSingle();
    if (error || !data) {
      setDataError("Η ακύρωση δεν ολοκληρώθηκε. Ίσως το ραντεβού έχει ήδη αλλάξει κατάσταση. Ανανεώνεται η λίστα.");
      const { data: latest } = await supabase.from("bookings")
        .select("id, service_id, customer_name, customer_phone, customer_email, starts_at, status, services(name)")
        .order("starts_at", { ascending: false });
      if (latest) setBookings(latest as unknown as Booking[]);
    } else {
      setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status: "cancelled" } : item));
      setNotice("Το ραντεβού ακυρώθηκε. Η ώρα είναι ξανά διαθέσιμη, εφόσον το επιτρέπει το ωράριο.");
    }
    setBusy(false);
  }

  const todayInAthens = athensDate(new Date());
  const visibleBookings = bookings.filter((booking) => {
    const localDate = athensDate(booking.starts_at);
    if (bookingFilter === "today") return localDate === todayInAthens;
    if (bookingFilter === "upcoming") return new Date(booking.starts_at).getTime() >= Date.now();
    if (bookingFilter === "date") return localDate === bookingDate;
    return true;
  });

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setLoginError("Τα στοιχεία σύνδεσης δεν είναι σωστά ή ο λογαριασμός δεν έχει ενεργοποιηθεί.");
    setBusy(false);
  }

  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signOut();
    setPassword("");
    setNotice("");
    setBusy(false);
  }

  async function saveService(service: Service) {
    if (!supabase) return;
    if (!service.name.trim() || !Number.isFinite(service.price) || service.price < 0) {
      setDataError("Συμπλήρωσε όνομα υπηρεσίας και έγκυρη τιμή.");
      return;
    }
    setBusy(true);
    setDataError("");
    const { data, error } = await supabase.from("services")
      .update({ name: service.name.trim(), price: service.price })
      .eq("id", service.id)
      .select("id")
      .single();
    if (error || !data) setDataError("Η αλλαγή δεν αποθηκεύτηκε. Δοκίμασε ξανά.");
    else setNotice("Η υπηρεσία αποθηκεύτηκε.");
    setBusy(false);
  }

  async function addService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const price = Number(newPrice);
    if (!newName.trim() || !Number.isFinite(price) || price < 0) {
      setDataError("Συμπλήρωσε όνομα υπηρεσίας και έγκυρη τιμή.");
      return;
    }
    setBusy(true);
    setDataError("");
    const { data, error } = await supabase.from("services")
      .insert({ name: newName.trim(), price, active: true })
      .select("id, name, price, active")
      .single();
    if (error || !data) setDataError("Η νέα υπηρεσία δεν αποθηκεύτηκε. Δοκίμασε ξανά.");
    else {
      setServices((current) => [...current, { ...data, price: Number(data.price) }].sort((a, b) => a.name.localeCompare(b.name, "el")));
      setNewName("");
      setNewPrice("15");
      setNotice("Η νέα υπηρεσία προστέθηκε.");
    }
    setBusy(false);
  }

  async function toggleService(service: Service) {
    if (!supabase) return;
    setBusy(true);
    setDataError("");
    const { data, error } = await supabase.from("services")
      .update({ active: !service.active })
      .eq("id", service.id)
      .select("id")
      .single();
    if (error || !data) setDataError("Η κατάσταση της υπηρεσίας δεν άλλαξε. Δοκίμασε ξανά.");
    else {
      setServices((current) => current.map((item) => item.id === service.id ? { ...item, active: !item.active } : item));
      setNotice(service.active ? "Η υπηρεσία απενεργοποιήθηκε. Οι παλιές κρατήσεις της διατηρούνται." : "Η υπηρεσία ενεργοποιήθηκε.");
    }
    setBusy(false);
  }

  function updateDay(weekday: number, changes: Partial<BusinessDay>) {
    setHours((current) => current.map((day) => {
      if (day.weekday !== weekday) return day;
      const next = { ...day, ...changes };
      return next;
    }));
  }

  async function saveHours(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    for (const day of hours) {
      if (!day.is_open) continue;
      if (!day.opens_at || !day.closes_at || day.opens_at >= day.closes_at) {
        setDataError("Για κάθε ανοιχτή ημέρα, η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.");
        return;
      }
      if (Boolean(day.break_start) !== Boolean(day.break_end)) {
        setDataError("Συμπλήρωσε και τις δύο ώρες του διαλείμματος ή άφησέ τες κενές.");
        return;
      }
      if (day.break_start && day.break_end &&
        (day.break_start >= day.break_end || day.break_start < day.opens_at || day.break_end > day.closes_at)) {
        setDataError("Το διάλειμμα πρέπει να βρίσκεται μέσα στο ωράριο λειτουργίας.");
        return;
      }
    }

    const rows = hours.map((day) => ({
      weekday: day.weekday,
      is_open: day.is_open,
      opens_at: day.is_open ? day.opens_at : null,
      closes_at: day.is_open ? day.closes_at : null,
      break_start: day.is_open ? day.break_start || null : null,
      break_end: day.is_open ? day.break_end || null : null,
      updated_at: new Date().toISOString(),
    }));

    setBusy(true);
    setDataError("");
    const { data, error } = await supabase.from("business_hours")
      .upsert(rows, { onConflict: "weekday" })
      .select("weekday");
    if (error || !data || data.length !== 7) {
      setDataError("Το ωράριο δεν αποθηκεύτηκε πλήρως. Έλεγξε τις ώρες και δοκίμασε ξανά.");
    } else {
      setNotice("Το εβδομαδιαίο ωράριο αποθηκεύτηκε στη βάση δεδομένων.");
      setHours(rows.map((day) => ({
        ...day,
        opens_at: timeValue(day.opens_at),
        closes_at: timeValue(day.closes_at),
        break_start: timeValue(day.break_start),
        break_end: timeValue(day.break_end),
      })));
    }
    setBusy(false);
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a className="admin-brand" href="/">
          <span className="admin-brand-mark">B</span>
          <span>BarberBook <small>ADMIN</small></span>
        </a>
        {authState === "authorized" && (
          <button className="admin-quiet-button" type="button" onClick={signOut} disabled={busy}>Αποσύνδεση</button>
        )}
      </header>

      <div className="admin-shell">
        {authState === "loading" || authState === "checking" ? (
          <section className="admin-panel"><p role="status">Έλεγχος πρόσβασης…</p></section>
        ) : authState === "signed_out" || (authState === "error" && !userId) ? (
          <section className="admin-login admin-panel">
            <p className="admin-eyebrow">ΧΩΡΟΣ ΔΙΑΧΕΙΡΙΣΗΣ</p>
            <h1>Καλώς ήρθες.</h1>
            <p className="admin-muted">Συνδέσου με τον λογαριασμό διαχειριστή του καταστήματος.</p>
            <form onSubmit={signIn} className="admin-form">
              <label htmlFor="admin-email">Email</label>
              <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <label htmlFor="admin-password">Κωδικός</label>
              <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              {loginError && <p className="admin-error" role="alert">{loginError}</p>}
              <button className="admin-primary" type="submit" disabled={busy}>{busy ? "Σύνδεση…" : "Σύνδεση"}</button>
            </form>
            <a className="admin-back-link" href="/">← Επιστροφή στις κρατήσεις</a>
          </section>
        ) : authState === "unauthorized" ? (
          <section className="admin-panel admin-message">
            <p className="admin-eyebrow">ΠΕΡΙΟΡΙΣΜΕΝΗ ΠΡΟΣΒΑΣΗ</p>
            <h1>Δεν έχεις δικαίωμα διαχείρισης.</h1>
            <p className="admin-muted">Ο λογαριασμός συνδέθηκε, αλλά δεν έχει εξουσιοδοτηθεί ως ο μοναδικός διαχειριστής του BarberBook.</p>
            <button className="admin-primary" type="button" onClick={signOut} disabled={busy}>Αποσύνδεση</button>
          </section>
        ) : authState === "error" ? (
          <section className="admin-panel admin-message">
            <h1>Δεν ήταν δυνατή η φόρτωση.</h1>
            <p className="admin-error" role="alert">{dataError || loginError}</p>
            <button className="admin-primary" type="button" onClick={() => window.location.reload()}>Δοκίμασε ξανά</button>
          </section>
        ) : (
          <>
            <div className="admin-heading">
              <div>
                <p className="admin-eyebrow">BARBERBOOK / ΡΥΘΜΙΣΕΙΣ</p>
                <h1>Διαχείριση καταστήματος</h1>
                <p className="admin-muted">Οι αλλαγές αποθηκεύονται απευθείας στη βάση δεδομένων.</p>
              </div>
              <span className="admin-user">{userId ? "Εξουσιοδοτημένος διαχειριστής" : ""}</span>
            </div>

            {dataError && <p className="admin-error admin-alert" role="alert">{dataError}</p>}
            {notice && <p className="admin-success admin-alert" role="status">{notice}</p>}

            <nav className="admin-main-tabs" aria-label="Κύριες ενότητες">
              <button type="button" className={activeTab === "appointments" ? "admin-main-tab is-active" : "admin-main-tab"} aria-current={activeTab === "appointments" ? "page" : undefined} onClick={() => setActiveTab("appointments")}>Ραντεβού</button>
              <button type="button" className={activeTab === "management" ? "admin-main-tab is-active" : "admin-main-tab"} aria-current={activeTab === "management" ? "page" : undefined} onClick={() => setActiveTab("management")}>Διαχείριση</button>
            </nav>

            {activeTab === "appointments" ? (
              <BookingsTab
                bookings={bookings}
                visibleBookings={visibleBookings}
                bookingFilter={bookingFilter}
                bookingDate={bookingDate}
                busy={busy}
                onFilterChange={setBookingFilter}
                onDateChange={setBookingDate}
                onCancel={(booking) => void cancelBooking(booking)}
                formatDate={formatAdminDate}
                formatTime={formatAdminTime}
              />
            ) : (
              <>
                <nav className="admin-sub-tabs" aria-label="Ρυθμίσεις καταστήματος">
                  <button type="button" className={managementTab === "services" ? "admin-sub-tab is-active" : "admin-sub-tab"} aria-current={managementTab === "services" ? "page" : undefined} onClick={() => setManagementTab("services")}>Υπηρεσίες &amp; Τιμές</button>
                  <button type="button" className={managementTab === "hours" ? "admin-sub-tab is-active" : "admin-sub-tab"} aria-current={managementTab === "hours" ? "page" : undefined} onClick={() => setManagementTab("hours")}>Εβδομαδιαίο Ωράριο</button>
                </nav>
                {managementTab === "services" ? (
                  <ServicesTab
                    services={services}
                    newName={newName}
                    newPrice={newPrice}
                    busy={busy}
                    onServiceChange={(service) => setServices((current) => current.map((item) => item.id === service.id ? service : item))}
                    onAdd={addService}
                    onNewNameChange={setNewName}
                    onNewPriceChange={setNewPrice}
                    onSave={(service) => void saveService(service)}
                    onToggle={(service) => void toggleService(service)}
                  />
                ) : (
                  <HoursTab
                    hours={hours}
                    busy={busy}
                    onDayChange={updateDay}
                    onSave={saveHours}
                  />
                )}
              </>
            )}

          </>
        )}
      </div>
    </main>
  );
}
