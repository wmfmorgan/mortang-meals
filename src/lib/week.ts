export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return formatDay(d);
}

export function shiftMonday(weekStart: string, weeks: number): string {
  const [year, month, day] = weekStart.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  date.setDate(date.getDate() + weeks * 7);
  return formatDay(date);
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parseMonday(weekStart: string): Date {
  const [year, month, day] = weekStart.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

function formatMonthDay(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "August 2026" from a Monday YYYY-MM-DD. */
export function weekMonthLabel(weekStart: string): string {
  const start = parseMonday(weekStart);
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ] as const;
  return `${names[start.getMonth()]} ${start.getFullYear()}`;
}

export function planDisplayName(plan: { name: string; weekStart: string }): string {
  const custom = plan.name.trim();
  return custom || weekRangeLabel(plan.weekStart);
}

/** Monday–Sunday label, e.g. "Aug 24–30, 2026" or "Aug 31–Sep 6, 2026". */
export function weekRangeLabel(weekStart: string): string {
  const start = parseMonday(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const endLabel =
    start.getMonth() === end.getMonth()
      ? String(end.getDate())
      : formatMonthDay(end);
  return `${formatMonthDay(start)}–${endLabel}, ${end.getFullYear()}`;
}

function formatDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
