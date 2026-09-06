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

function formatDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
