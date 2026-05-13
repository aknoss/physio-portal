import type { SessionStatus } from '@physio-portal/contracts';

function parseISO(date: string): { year: number; month: number; day: number } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return { year: y, month: m, day: d };
}

function toISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function weekRangeFor(date: string): { from: string; to: string } {
  const { year, month, day } = parseISO(date);
  const ref = new Date(Date.UTC(year, month - 1, day));
  // JS getUTCDay: 0 = Sun .. 6 = Sat. Convert to 0 = Mon .. 6 = Sun.
  const dow = (ref.getUTCDay() + 6) % 7;
  const monday = new Date(ref);
  monday.setUTCDate(ref.getUTCDate() - dow);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: toISO(monday), to: toISO(sunday) };
}

export function monthRangeFor(date: string): { from: string; to: string } {
  const { year, month } = parseISO(date);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this month
  return { from: toISO(first), to: toISO(last) };
}

export function sumCompletedCents(
  sessions: ReadonlyArray<{ status: SessionStatus; priceCents: number }>,
): number {
  let total = 0;
  for (const s of sessions) {
    if (s.status === 'COMPLETED') total += s.priceCents;
  }
  return total;
}
