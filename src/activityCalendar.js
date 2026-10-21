// Date-only log values are local calendar dates, never UTC instants.
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function activityByDay(food = [], milk = [], weight = []) {
  const days = {};
  for (const [kind, entries] of [
    ["food", food],
    ["milk", milk],
    ["weight", weight],
  ]) {
    for (const entry of entries) {
      const day = entry.date;
      if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      days[day] ||= { food: 0, milk: 0, weight: 0 };
      days[day][kind]++;
    }
  }
  return days;
}
export function monthCells(year, month) {
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const length = Math.ceil((leading + count) / 7) * 7;
  return Array.from({ length }, (_, i) =>
    i < leading || i >= leading + count
      ? null
      : localDay(new Date(year, month, i - leading + 1)),
  );
}
