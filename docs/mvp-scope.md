# BarberBook MVP Scope

## 1. Product Goal

BarberBook is a simple online booking system for a single barber shop operated by one barber. The MVP enables customers to book an available appointment online without creating an account, while allowing the administrator/barber to manage bookings, services, and periods when bookings are unavailable.

The MVP is intentionally limited to one business, one location, one barber, and a single 30-minute appointment-slot model. Its priority is a reliable end-to-end booking flow and straightforward day-to-day administration.

## 2. Customer Flow

1. The customer opens the booking experience and views the services currently available for booking.
2. The customer selects one active service.
3. The customer selects a date.
4. The system displays the available 30-minute time slots for that date, taking existing bookings and blocked periods into account.
5. The customer selects an available time slot.
6. The customer enters their name, telephone number, and email address.
7. The customer reviews and confirms the booking.
8. The server validates the submitted details and checks the slot's availability again before creating the booking. If the slot is no longer available, the booking is not created and the customer is asked to choose another available time.
9. When the booking is successfully created, the customer sees a confirmation of the booking details.

Customers do not need an account to make a booking.

## 3. Admin Capabilities

The MVP provides one authenticated administrator account for the barber. The administrator can:

- Log in to the administration area.
- View the shop's bookings and their relevant details, including customer contact details, service, date, time, and booking status.
- Cancel an existing booking.
- Create a service, including the information needed to present it to customers.
- Edit an existing service.
- Deactivate a service so it is no longer offered for new bookings. Deactivation must not silently delete historical bookings associated with that service.
- Create blocked periods during which customers cannot book.
- Review and manage the blocked periods that have been created.

Only the single administrator/barber is supported; there are no staff roles or multi-user administration workflows in this MVP.

## 4. Business Rules

- **Single business:** The system serves exactly one barber shop.
- **Single barber:** The system supports exactly one barber and one appointment schedule.
- **Fixed appointment slots:** Every appointment slot is 30 minutes. Service-specific appointment durations are not supported.
- **Timezone:** All booking dates, times, availability checks, and blocked periods use the `Europe/Athens` timezone. The system must handle daylight-saving-time changes consistently.
- **No double booking:** A given appointment slot can have at most one active booking. Concurrent booking attempts for the same slot must not result in two successful bookings.
- **Server-side availability validation:** Availability shown to the customer is informative, not a guarantee. Immediately before creating a booking, the server must re-check that the selected slot is still available.
- **Atomic booking protection:** The final availability check and booking creation must be protected against concurrent requests (for example, through a database constraint or transaction-backed locking), so the no-double-booking rule is enforced by the system and not only by the user interface.
- **Existing bookings:** A slot occupied by an existing non-cancelled booking is unavailable for another booking.
- **Blocked periods:** No booking may be created for a slot that falls within a blocked period. Blocked periods must be considered both when displaying availability and during the server-side validation at booking creation.
- **Active services only:** Customers can select only active services. Deactivating a service prevents new bookings for it without erasing historical booking records.
- **Booking details:** A customer booking requires a name, telephone number, and email address. These details must be validated before the booking is created.

## 5. Out of Scope

The following are explicitly excluded from this MVP:

- Multiple businesses.
- Multiple locations.
- Multiple barbers.
- Different appointment durations per service.
- Online payments.
- SMS or WhatsApp notifications.
- Customer accounts.
- Loyalty system.
- Reviews.
- Mobile application.
- Recurring appointments.
- Analytics.
- Google Calendar integration.

These items must not be added as part of the MVP unless the scope is explicitly revised.

## 6. Definition of Done

The MVP is considered complete only when all of the following conditions are met:

- A customer can view active services and select one.
- A customer can choose a date and see the available 30-minute slots for that date.
- Availability correctly excludes slots occupied by existing non-cancelled bookings and slots covered by blocked periods.
- A customer can select a slot and submit a valid name, telephone number, and email address without creating a customer account.
- The server re-validates availability when the customer confirms the booking; a slot that has become unavailable is rejected with a clear message and no booking is created.
- Two concurrent attempts to book the same slot cannot both succeed.
- A successful booking is persisted and a clear confirmation with its essential details is shown to the customer.
- The single administrator/barber can securely log in and view bookings.
- The administrator can cancel a booking, and a cancelled booking no longer prevents that slot from being offered, provided no other rule makes it unavailable.
- The administrator can create, edit, and deactivate services; customers see only active services, and historical bookings remain intact.
- The administrator can create and review blocked periods, and those periods prevent bookings through both availability display and server-side booking validation.
- Booking times and blocked periods are handled consistently in the `Europe/Athens` timezone, including daylight-saving-time transitions.
- The complete customer and administrator flows work in the deployed application, with appropriate validation and understandable error states.
- No functionality listed in **Out of Scope** is required for acceptance of this MVP.

All conditions above must be satisfied for the MVP to be accepted as complete. Anything beyond this list requires a separate scope decision.
