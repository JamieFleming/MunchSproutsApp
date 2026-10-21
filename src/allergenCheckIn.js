import { localDay } from "./activityCalendar";
export const CHECK_IN_DELAY_MS = 48 * 60 * 60 * 1000;

/** Use the logged time when available. Date-only historical entries use local noon. */
export function exposureTime(entry) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date || "")) return NaN;
  if (/^\d{2}:\d{2}$/.test(entry.time || ""))
    return new Date(`${entry.date}T${entry.time}:00`).getTime();
  const logged = new Date(entry.loggedAt || "");
  if (Number.isFinite(logged.getTime()) && localDay(logged) === entry.date)
    return logged.getTime();
  return new Date(`${entry.date}T12:00:00`).getTime();
}

// Shared by the on-screen check-in and notifications, so the same 48-hour clock
// applies to both. This is a record-keeping prompt, never an allergy diagnosis.
export function hasAllergenCheckIn(entry, allergen) {
  return Array.isArray(entry.allergenCheckIns)
    ? entry.allergenCheckIns.includes(allergen)
    : !!entry.isAllergenCheckin;
}
export function allergenCheckIn(entries, allergen) {
  if (
    entries.some(
      (entry) =>
        entry.reaction === "Allergic" || hasAllergenCheckIn(entry, allergen),
    )
  )
    return null;
  const first = entries
    .map((entry) => ({ entry, time: exposureTime(entry) }))
    .filter(({ time }) => Number.isFinite(time))
    .sort((a, b) => a.time - b.time)[0];
  return first
    ? { entry: first.entry, due: first.time + CHECK_IN_DELAY_MS }
    : null;
}
