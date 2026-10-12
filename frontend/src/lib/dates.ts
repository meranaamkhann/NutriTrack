// The diary is keyed by the user's own calendar day (YYYY-MM-DD in their
// browser's timezone) and the server stores exactly that day, so "today"
// never depends on a server timezone or a stale profile setting.
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

function fromDateString(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(value: string, days: number): string {
  const date = fromDateString(value);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export function formatDayLabel(value: string): string {
  const today = todayString();
  if (value === today) return "Today";
  if (value === addDays(today, -1)) return "Yesterday";
  return fromDateString(value).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatLongDate(value: string): string {
  return fromDateString(value).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

// An instant that sorts sensibly inside the chosen day: right now for today,
// midday for any other day.
export function loggedAtFor(value: string): string {
  if (value === todayString()) return new Date().toISOString();
  const date = fromDateString(value);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
