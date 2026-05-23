import CalendarClient from "./calendar-client";

/**
 * Creator's catering calendar.
 *
 * PR 1: read-only view of blackouts + tools to add/remove them.
 *       No bookings yet (those land in PR 3).
 *
 * PR 3 will pipe `catering_bookings` into this page so the dot
 * badges fill in.
 */
export default function CateringCalendarPage() {
  return <CalendarClient />;
}
