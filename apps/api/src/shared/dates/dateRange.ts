function parseISO(date: string): { year: number; month: number; day: number } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return { year: y, month: m, day: d };
}

function toISO(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function maxIsoDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function enumerateDates(from: string, to: string): string[] {
  if (from > to) return [];
  const start = parseISO(from);
  const end = parseISO(to);
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const stop = Date.UTC(end.year, end.month - 1, end.day);
  const out: string[] = [];
  while (cursor.getTime() <= stop) {
    out.push(
      toISO(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()),
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function weekdayOfIsoDate(date: string): number {
  const { year, month, day } = parseISO(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
