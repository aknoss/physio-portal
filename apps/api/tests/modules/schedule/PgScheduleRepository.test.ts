import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  type PgFixture,
  startPostgres,
  stopPostgres,
} from '../../helpers/postgres.js';
import { PgPatientRepository } from '../../../src/modules/patients/PgPatientRepository.js';
import { PgScheduleRepository } from '../../../src/modules/schedule/PgScheduleRepository.js';

let fixture: PgFixture;
let patients: PgPatientRepository;
let schedules: PgScheduleRepository;

beforeAll(async () => {
  fixture = await startPostgres();
  await applyMigrations(fixture.pool);
  patients = new PgPatientRepository(fixture.pool);
  schedules = new PgScheduleRepository(fixture.pool);
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

describe('PgScheduleRepository', () => {
  it('upsert inserts a new schedule', async () => {
    const patient = await patients.create(samplePatient);
    const schedule = await schedules.upsert({
      patientId: patient.id,
      weekdays: [1, 3, 5],
      startDate: '2026-03-01',
      endDate: null,
    });
    expect(schedule.patientId).toBe(patient.id);
    expect(schedule.weekdays).toEqual([1, 3, 5]);
    expect(schedule.startDate).toBe('2026-03-01');
    expect(schedule.endDate).toBeNull();
  });

  it('upsert overwrites the existing row for the same patient', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-01-01',
      endDate: null,
    });
    const updated = await schedules.upsert({
      patientId: patient.id,
      weekdays: [2, 4],
      startDate: '2026-04-01',
      endDate: '2026-12-31',
    });
    expect(updated.weekdays).toEqual([2, 4]);
    expect(updated.startDate).toBe('2026-04-01');
    expect(updated.endDate).toBe('2026-12-31');
  });

  it('findByPatientId returns the schedule', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-01-01',
      endDate: null,
    });
    const found = await schedules.findByPatientId(patient.id);
    expect(found?.patientId).toBe(patient.id);
    expect(found?.weekdays).toEqual([1]);
  });

  it('findByPatientId returns null when no schedule exists', async () => {
    const patient = await patients.create(samplePatient);
    expect(await schedules.findByPatientId(patient.id)).toBeNull();
  });
});
