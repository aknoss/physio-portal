import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  type PgFixture,
  startPostgres,
  stopPostgres,
} from '../../helpers/postgres.js';
import { PgPatientRepository } from '../../../src/modules/patients/PgPatientRepository.js';
import { PgSessionRepository } from '../../../src/modules/sessions/PgSessionRepository.js';
import { PgReportRepository } from '../../../src/modules/reports/PgReportRepository.js';

let fixture: PgFixture;
let patients: PgPatientRepository;
let sessions: PgSessionRepository;
let reports: PgReportRepository;

beforeAll(async () => {
  fixture = await startPostgres();
  await applyMigrations(fixture.pool);
  patients = new PgPatientRepository(fixture.pool);
  sessions = new PgSessionRepository(fixture.pool);
  reports = new PgReportRepository(fixture.pool);
});

afterAll(async () => {
  await stopPostgres(fixture);
});

beforeEach(async () => {
  await fixture.pool.query('TRUNCATE patients CASCADE');
});

const samplePatient = {
  fullName: 'Raiany',
  address: 'Rua A, 123',
  phone: '+5521987654321',
  sessionPriceCents: 12000,
  notes: null,
};

async function seedSessions(
  patientId: string,
  rows: { date: string; status: 'SCHEDULED' | 'COMPLETED' | 'MISSED' | 'RESCHEDULED'; priceCents: number }[],
): Promise<void> {
  for (const row of rows) {
    const [created] = await sessions.bulkCreateScheduled([
      { patientId, date: row.date, priceCents: row.priceCents },
    ]);
    if (row.status !== 'SCHEDULED') {
      await sessions.update(created!.id, { status: row.status });
    }
  }
}

describe('PgReportRepository.summaryInRange', () => {
  it('returns zeros when there are no sessions', async () => {
    const result = await reports.summaryInRange('2026-03-01', '2026-03-31');
    expect(result).toEqual({ totalCents: 0, sessionCount: 0 });
  });

  it('sums COMPLETED sessions across all patients in range', async () => {
    const a = await patients.create({ ...samplePatient, fullName: 'A' });
    const b = await patients.create({ ...samplePatient, fullName: 'B' });
    await seedSessions(a.id, [
      { date: '2026-03-02', status: 'COMPLETED', priceCents: 12000 },
      { date: '2026-03-09', status: 'MISSED', priceCents: 12000 },
    ]);
    await seedSessions(b.id, [
      { date: '2026-03-03', status: 'COMPLETED', priceCents: 8000 },
      { date: '2026-03-10', status: 'RESCHEDULED', priceCents: 8000 },
      { date: '2026-04-01', status: 'COMPLETED', priceCents: 8000 },
    ]);
    const result = await reports.summaryInRange('2026-03-01', '2026-03-31');
    expect(result).toEqual({ totalCents: 20000, sessionCount: 2 });
  });

  it('excludes SCHEDULED, MISSED, and RESCHEDULED from the totals', async () => {
    const p = await patients.create(samplePatient);
    await seedSessions(p.id, [
      { date: '2026-03-02', status: 'SCHEDULED', priceCents: 12000 },
      { date: '2026-03-04', status: 'MISSED', priceCents: 12000 },
      { date: '2026-03-06', status: 'RESCHEDULED', priceCents: 12000 },
    ]);
    const result = await reports.summaryInRange('2026-03-01', '2026-03-31');
    expect(result).toEqual({ totalCents: 0, sessionCount: 0 });
  });
});

describe('PgReportRepository.patientSummaryInRange', () => {
  it('scopes totals to a single patient', async () => {
    const a = await patients.create({ ...samplePatient, fullName: 'A' });
    const b = await patients.create({ ...samplePatient, fullName: 'B' });
    await seedSessions(a.id, [
      { date: '2026-03-02', status: 'COMPLETED', priceCents: 12000 },
      { date: '2026-03-09', status: 'COMPLETED', priceCents: 12000 },
    ]);
    await seedSessions(b.id, [
      { date: '2026-03-03', status: 'COMPLETED', priceCents: 9999 },
    ]);
    const result = await reports.patientSummaryInRange(a.id, '2026-03-01', '2026-03-31');
    expect(result).toEqual({ totalCents: 24000, sessionCount: 2 });
  });

  it('returns zeros when the patient has no COMPLETED sessions in range', async () => {
    const p = await patients.create(samplePatient);
    await seedSessions(p.id, [
      { date: '2026-02-01', status: 'COMPLETED', priceCents: 12000 },
      { date: '2026-04-01', status: 'COMPLETED', priceCents: 12000 },
    ]);
    const result = await reports.patientSummaryInRange(p.id, '2026-03-01', '2026-03-31');
    expect(result).toEqual({ totalCents: 0, sessionCount: 0 });
  });
});

describe('PgReportRepository.rankingInRange', () => {
  it('returns an empty list when no patient has COMPLETED sessions in range', async () => {
    const result = await reports.rankingInRange('2026-03-01', '2026-03-31');
    expect(result).toEqual([]);
  });

  it('groups COMPLETED sessions by patient ordered by total desc', async () => {
    const a = await patients.create({ ...samplePatient, fullName: 'Ana' });
    const b = await patients.create({ ...samplePatient, fullName: 'Bruno' });
    const c = await patients.create({ ...samplePatient, fullName: 'Caio' });
    await seedSessions(a.id, [
      { date: '2026-03-02', status: 'COMPLETED', priceCents: 12000 },
      { date: '2026-03-09', status: 'COMPLETED', priceCents: 12000 },
    ]);
    await seedSessions(b.id, [
      { date: '2026-03-03', status: 'COMPLETED', priceCents: 9000 },
      { date: '2026-03-10', status: 'COMPLETED', priceCents: 9000 },
      { date: '2026-03-17', status: 'COMPLETED', priceCents: 9000 },
    ]);
    await seedSessions(c.id, [
      { date: '2026-03-04', status: 'MISSED', priceCents: 12000 },
    ]);
    const result = await reports.rankingInRange('2026-03-01', '2026-03-31');
    expect(result).toEqual([
      { patientId: b.id, fullName: 'Bruno', totalCents: 27000, sessionCount: 3 },
      { patientId: a.id, fullName: 'Ana', totalCents: 24000, sessionCount: 2 },
    ]);
  });

  it('breaks ties by full_name ascending', async () => {
    const a = await patients.create({ ...samplePatient, fullName: 'Zora' });
    const b = await patients.create({ ...samplePatient, fullName: 'Alma' });
    await seedSessions(a.id, [
      { date: '2026-03-02', status: 'COMPLETED', priceCents: 10000 },
    ]);
    await seedSessions(b.id, [
      { date: '2026-03-02', status: 'COMPLETED', priceCents: 10000 },
    ]);
    const result = await reports.rankingInRange('2026-03-01', '2026-03-31');
    expect(result.map((r) => r.fullName)).toEqual(['Alma', 'Zora']);
  });

  it('ignores non-COMPLETED statuses and out-of-range sessions', async () => {
    const a = await patients.create(samplePatient);
    await seedSessions(a.id, [
      { date: '2026-02-28', status: 'COMPLETED', priceCents: 5000 },
      { date: '2026-03-02', status: 'MISSED', priceCents: 12000 },
      { date: '2026-04-01', status: 'COMPLETED', priceCents: 5000 },
    ]);
    const result = await reports.rankingInRange('2026-03-01', '2026-03-31');
    expect(result).toEqual([]);
  });
});
