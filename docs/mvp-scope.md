# BarberBook MVP Scope

## 1. Product Goal

BarberBook is a simple online booking system for one barber shop and one location. It supports multiple barbers working at the same shop. Customers can book a 30-minute appointment without creating an account, choose a specific active barber or select “Δεν έχω προτίμηση”, and see only times when at least one eligible barber is available. One authenticated shop administrator manages the entire business, its staff, services, schedules, bookings, and blocked periods.

This document is the authoritative source of truth for the MVP. The multi-barber capability is an explicitly approved expansion of the original single-barber scope.

## 2. Customer Booking Flow

1. The customer views active services and selects one.
2. If at least one active barber exists, the customer always sees the barber-selection step. With exactly one active barber, that barber is preselected; with multiple active barbers, all active barbers are shown. The customer can also select “Δεν έχω προτίμηση”. Inactive barbers are never shown.
3. The customer selects a date.
4. The system displays available 30-minute slots:
   - For a selected barber, only slots available for that barber are shown.
   - For “Δεν έχω προτίμηση”, a slot is shown if at least one active barber is available.
5. The customer selects a time and enters their name, telephone number, and email address.
6. The customer reviews and confirms the booking.
7. The server validates the service, barber selection, date, slot, store hours, barber hours, breaks, existing bookings, and applicable blocked periods again immediately before creating the booking.
8. If a specific barber was selected, the booking is assigned to that barber only. If no preference was selected, the server assigns the booking to one actually available barber using a deterministic order and a transaction-safe recheck.
9. The customer sees confirmation only after the booking is successfully persisted, including the assigned barber.

Customers do not need an account to book.

## 3. Admin Capabilities

There is one authenticated shop administrator. The administrator manages the whole shop; there are no separate employee accounts or staff login roles.

The administrator can:
- Log in to the administration area.
- View all bookings, including customer contact details, service, assigned barber, date, time, and status.
- Filter bookings by existing date/status filters and by barber.
- Cancel a confirmed booking without deleting its history.
- Create, edit, and deactivate services. Deactivation prevents new bookings but preserves historical records.
- Manage barbers: add a barber; edit a display name; optionally upload or replace a profile photo; activate or deactivate a barber; preserve historical bookings when a barber is deactivated.
- Configure a separate weekly schedule for each barber, including opening/closing times and breaks.
- Create and review shop-wide blocked periods that apply to every barber.
- Create and review barber-specific blocked periods and leave, which apply only to the selected barber.
- Remove a blocked period when plans change, provided no existing booking conflict is silently discarded.

## 4. Business and Scheduling Rules

- **One shop, one location:** The application serves one barber shop.
- **Multiple barbers:** The shop can have multiple barber records. Only active barbers can receive new bookings. Deactivation never deletes the barber or their booking history.
- **Store schedule is the upper bound:** The existing shop-wide weekly hours remain authoritative. A barber can receive bookings only during the intersection of the shop's opening hours and that barber's own weekly hours.
- **Barber schedule:** Each barber has seven weekly schedule rows, with open/closed status, opening/closing times, and an optional break. New barbers receive an initial schedule based on the current shop hours; the administrator can then customize it.
- **Fixed appointment slots:** Every appointment is 30 minutes. Variable service durations are not supported. Slot boundaries remain aligned to the existing 30-minute grid.
- **Timezone:** Booking dates, times, weekly schedules, blocked periods, and availability use the Europe/Athens IANA timezone. Daylight-saving transitions must be handled using the timezone, not a fixed UTC offset. Nonexistent local times must be rejected; repeated local times must not create duplicate slots.
- **Per-barber double-booking protection:** A barber cannot have overlapping confirmed bookings. Two different barbers may have confirmed bookings at the same time.
- **Atomic booking protection:** Availability checks and booking creation must be protected against concurrent requests. The database must enforce no overlap per barber independently of the UI. When no preference is selected, barber selection and booking insertion must be atomic and revalidated.
- **Specific barber:** A requested barber must still be active and available at the requested time; otherwise the booking is rejected.
- **No preference:** The server chooses an active, available barber in a stable deterministic order. It must not create a booking unless a barber is actually available.
- **Store-wide blocked periods:** A blocked period with no barber assigned applies to all barbers and prevents all bookings in its time range.
- **Personal blocked periods and leave:** A blocked period assigned to one barber prevents only that barber from receiving bookings in the period.
- **Booking overlap:** Any new shop-wide block must be checked against all confirmed bookings; a barber-specific block must be checked against confirmed bookings for that barber. Conflicts must be reported to the administrator; the system must not automatically cancel or reassign existing bookings.
- **Services:** Customers can select only active services. Historical bookings retain their original service association.
- **Customer details:** A booking requires a valid name, telephone number, and email address.
- **Privacy and access:** Customers can read active barber display information needed for booking, but cannot read customer bookings, customer personal data, private staff schedules, or administrator data. Only the existing authorized administrator can manage staff, schedules, bookings, and blocked periods. Staff do not receive accounts.
- **Historical migration:** Every pre-existing booking must be assigned to the original barber record during migration. No existing booking or customer data may be deleted or lost. The original barber record is retained and can be renamed by the administrator.

## 5. Data Model and Migration Requirements

- Add barbers with a stable UUID, display name, optional profile photo URL/path, active flag, ordering/creation metadata, and timestamps.
- Seed one initial barber representing the original single-barber schedule. Backfill every existing booking to that barber before enforcing bookings.barber_id NOT NULL.
- Add barber_business_hours with one row per barber and weekday, including open/close and optional break times. Seed the original barber from the existing business_hours; seed newly added barbers from current shop hours.
- Add bookings.barber_id with a foreign key that preserves history and prevents deleting referenced barbers.
- Extend blocked_periods with nullable barber_id: NULL means shop-wide; a barber UUID means personal to that barber.
- Replace the old one-confirmed-booking-per-start-time constraint only after the new per-barber overlap constraint and booking RPC have been installed and verified. The new database constraint must allow simultaneous bookings for different barbers and reject overlapping confirmed bookings for the same barber.
- Retain the existing shop-wide business_hours and store-wide block semantics.

## 6. Out of Scope

- Multiple businesses or locations.
- Separate barber/employee accounts, roles, or staff dashboards.
- Different appointment durations per service.
- Online payments.
- SMS, WhatsApp, or email notifications.
- Customer accounts.
- Loyalty system or reviews.
- Mobile application.
- Recurring appointments.
- Analytics or Google Calendar integration.

These features require a separate scope decision.

## 7. Definition of Done

- The original barber and all existing bookings are preserved and correctly linked.
- The administrator can add, edit, activate, deactivate, and optionally upload a photo for barbers.
- The administrator can configure weekly hours for each barber independently.
- Shop hours cap all barber schedules; barber-specific leave and blocked periods affect only the selected barber; shop-wide blocks affect all barbers.
- The customer always sees the barber selection step when at least one active barber exists; with one active barber it is preselected, and with multiple active barbers all active barbers are shown. “Δεν έχω προτίμηση” remains available.
- Selecting a barber shows only that barber's available slots. “Δεν έχω προτίμηση” shows slots available for at least one active barber.
- “Δεν έχω προτίμηση” always results in an atomic assignment to a real available barber, returned in the booking confirmation.
- Two different barbers can be booked at the same time.
- One barber cannot receive overlapping confirmed bookings, including under concurrent requests.
- Inactive barbers cannot receive new bookings; their historical bookings remain visible to the administrator.
- Admin bookings show the assigned barber and support filtering by barber while preserving existing date/status filters.
- RLS and function grants preserve the existing admin-only access to bookings and customer personal data. Public users can read only active barber profile information and public availability.
- The system handles Europe/Athens daylight-saving transitions correctly.
- Tests verify same-time bookings for different barbers, rejection of same-barber overlaps, deterministic no-preference assignment, blocked-period behavior, and preservation of historical data.
- Production acceptance requires a verified successful deployment and corresponding browser tests.

All conditions above are required for acceptance. Further functionality requires a separate scope decision.