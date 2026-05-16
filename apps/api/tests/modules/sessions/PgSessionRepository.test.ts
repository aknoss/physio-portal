import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  type PgFixture,
  startPostgres,
  stopPostgres,
} from '../../helpers/postgres.js';
import { PgPatientRepository } from '../../../src/modules/patients/PgPatientRepository.js';
import { PgSessionRepository } from '../../../src/modules/sessions/PgSessionRepository.js';

let fixture: PgFixture;
let patients: PgPatientRepository;
let sessions: PgSessionRepository;

beforeAll(async () => {
  fixture = await startPostgres();
  await applyMigrations(fixture.pool);
  patients = new PgPatientRepository(fixture.pool);
  sessions = new PgSessionRepository(fixture.pool);
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

describe('PgSessionRepository', () => {
  it('bulkCreateScheduled is a no-op when no inputs are given', async () => {
    const created = await sessions.bulkCreateScheduled([]);
    expect(created).toEqual([]);
  });

  it('bulkCreateScheduled inserts sessions with status=SCHEDULED', async () => {
    const patient = await patients.create(samplePatient);
    const created = await sessions.bulkCreateScheduled([
      { patientId: patient.id, date: '2026-03-02', priceCents: 12000 },
      { patientId: patient.id, date: '2026-03-04', priceCents: 12000 },
    ]);
    expect(created).toHaveLength(2);
    expect(created.every((s) => s.status === 'SCHEDULED')).toBe(true);
    expect(created.every((s) => s.note === null)).toBe(true);
  });

  it('bulkCreateScheduled is idempotent on (patient_id, date)', async () => {
    const patient = await patients.create(samplePatient);
    await sessions.bulkCreateScheduled([
      { patientId: patient.id, date: '2026-03-02', priceCents: 12000 },
    ]);
    const second = await sessions.bulkCreateScheduled([
      { patientId: patient.id, date: '2026-03-02', priceCents: 12000 },
      { patientId: patient.id, date: '2026-03-04', priceCents: 12000 },
    ]);
    expect(second.map((s) => s.date)).toEqual(['2026-03-04']);
  });

  it('listByPatientInRange returns sessions ordered by date', async () => {
    const patient = await patients.create(samplePatient);
    await sessions.bulkCreateScheduled([
      { patientId: patient.id, date: '2026-03-09', priceCents: 12000 },
      { patientId: patient.id, date: '2026-03-02', priceCents: 12000 },
      { patientId: patient.id, date: '2026-04-01', priceCents: 12000 },
    ]);
    const list = await sessions.listByPatientInRange(patient.id, '2026-03-01', '2026-03-31');
    expect(list.map((s) => s.date)).toEqual(['2026-03-02', '2026-03-09']);
  });

  it('listByPatientInRange scopes to the patient', async () => {
    const a = await patients.create({ ...samplePatient, fullName: 'A' });
    const b = await patients.create({ ...samplePatient, fullName: 'B' });
    await sessions.bulkCreateScheduled([
      { patientId: a.id, date: '2026-03-02', priceCents: 12000 },
      { patientId: b.id, date: '2026-03-02', priceCents: 12000 },
    ]);
    const list = await sessions.listByPatientInRange(a.id, '2026-03-01', '2026-03-31');
    expect(list).toHaveLength(1);
    expect(list[0]!.patientId).toBe(a.id);
  });

  it('findById returns the session', async () => {
    const patient = await patients.create(samplePatient);
    const [created] = await sessions.bulkCreateScheduled([
      { patientId: patient.id, date: '2026-03-02', priceCents: 12000 },
    ]);
    const found = await sessions.findById(created!.id);
    expect(found?.id).toBe(created!.id);
  });

  it('findById returns null for an unknown id', async () => {
    const found = await sessions.findById('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });

  it('update changes status and note', async () => {
    const patient = await patients.create(samplePatient);
    const [created] = await sessions.bulkCreateScheduled([
      { patientId: patient.id, date: '2026-03-02', priceCents: 12000 },
    ]);
    const updated = await sessions.update(created!.id, {
      status: 'COMPLETED',
      note: 'ok',
    });
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.note).toBe('ok');
  });

  it('update can clear the note', async () => {
    const patient = await patients.create(samplePatient);
    const [created] = await sessions.bulkCreateScheduled([
      { patientId: patient.id, date: '2026-03-02', priceCents: 12000 },
    ]);
    await sessions.update(created!.id, { note: 'temp' });
    const cleared = await sessions.update(created!.id, { note: null });
    expect(cleared?.note).toBeNull();
  });

  it('update with no fields returns the row unchanged', async () => {
    const patient = await patients.create(samplePatient);
    const [created] = await sessions.bulkCreateScheduled([
      { patientId: patient.id, date: '2026-03-02', priceCents: 12000 },
    ]);
    const result = await sessions.update(created!.id, {});
    expect(result?.id).toBe(created!.id);
    expect(result?.status).toBe('SCHEDULED');
  });

  it('update returns null for an unknown id', async () => {
    const result = await sessions.update('00000000-0000-0000-0000-000000000000', {
      status: 'COMPLETED',
    });
    expect(result).toBeNull();
  });
});
