import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../src/shared/http/HttpError.js';
import { SessionService } from '../../../src/modules/sessions/SessionService.js';
import {
  InMemoryPatientRepository,
  InMemoryScheduleRepository,
  InMemorySessionRepository,
} from '../../helpers/fakes.js';

const samplePatient = {
  fullName: 'Raiany Silva',
  address: 'Rua A, 123',
  phone: '+5521987654321',
  sessionPriceCents: 12000,
  notes: null,
};

let patients: InMemoryPatientRepository;
let schedules: InMemoryScheduleRepository;
let sessions: InMemorySessionRepository;
let service: SessionService;

beforeEach(() => {
  patients = new InMemoryPatientRepository();
  schedules = new InMemoryScheduleRepository();
  sessions = new InMemorySessionRepository();
  service = new SessionService(sessions, schedules, patients);
});

describe('SessionService.generate', () => {
  it('generates one session per matching weekday in range', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1, 3, 5],
      startDate: '2026-03-01',
      endDate: null,
    });
    const result = await service.generate(patient.id, '2026-03-02', '2026-03-08');
    expect(result.map((s) => s.date)).toEqual([
      '2026-03-02',
      '2026-03-04',
      '2026-03-06',
    ]);
    expect(result.every((s) => s.status === 'SCHEDULED')).toBe(true);
    expect(result.every((s) => s.priceCents === patient.sessionPriceCents)).toBe(true);
  });

  it('handles a 5-Monday month (March 2026)', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-01-01',
      endDate: null,
    });
    const result = await service.generate(patient.id, '2026-03-01', '2026-03-31');
    expect(result.map((s) => s.date)).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
      '2026-03-23',
      '2026-03-30',
    ]);
  });

  it('clips the range to schedule.startDate', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-03-15',
      endDate: null,
    });
    const result = await service.generate(patient.id, '2026-03-01', '2026-03-31');
    expect(result.map((s) => s.date)).toEqual(['2026-03-16', '2026-03-23', '2026-03-30']);
  });

  it('clips the range to schedule.endDate', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-01-01',
      endDate: '2026-03-15',
    });
    const result = await service.generate(patient.id, '2026-03-01', '2026-03-31');
    expect(result.map((s) => s.date)).toEqual(['2026-03-02', '2026-03-09']);
  });

  it('crosses DST without skipping or duplicating sessions', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-01-01',
      endDate: null,
    });
    const result = await service.generate(patient.id, '2026-03-07', '2026-03-09');
    expect(result.map((s) => s.date)).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
    ]);
  });

  it('is idempotent — re-running does not duplicate sessions', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-03-01',
      endDate: null,
    });
    await service.generate(patient.id, '2026-03-01', '2026-03-31');
    const second = await service.generate(patient.id, '2026-03-01', '2026-03-31');
    expect(second.map((s) => s.date)).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
      '2026-03-23',
      '2026-03-30',
    ]);
    expect(sessions.snapshot()).toHaveLength(5);
  });

  it('returns an empty list when the requested range is entirely before the schedule starts', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-06-01',
      endDate: null,
    });
    const result = await service.generate(patient.id, '2026-03-01', '2026-03-31');
    expect(result).toEqual([]);
    expect(sessions.snapshot()).toEqual([]);
  });

  it('returns an empty list when no weekday in the range matches the schedule', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-01-01',
      endDate: null,
    });
    const result = await service.generate(patient.id, '2026-03-03', '2026-03-08');
    expect(result).toEqual([]);
  });

  it('throws NotFoundError when the patient does not exist', async () => {
    await expect(
      service.generate('00000000-0000-0000-0000-000000000000', '2026-03-01', '2026-03-31'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when the patient has no schedule', async () => {
    const patient = await patients.create(samplePatient);
    await expect(
      service.generate(patient.id, '2026-03-01', '2026-03-31'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('SessionService.listInRange', () => {
  it('returns sessions inside the inclusive range, sorted by date', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1, 3, 5],
      startDate: '2026-03-01',
      endDate: null,
    });
    await service.generate(patient.id, '2026-03-01', '2026-03-31');
    const result = await service.listInRange(patient.id, '2026-03-04', '2026-03-13');
    expect(result.map((s) => s.date)).toEqual([
      '2026-03-04',
      '2026-03-06',
      '2026-03-09',
      '2026-03-11',
      '2026-03-13',
    ]);
  });

  it('returns an empty list when no sessions match', async () => {
    const patient = await patients.create(samplePatient);
    const result = await service.listInRange(patient.id, '2026-03-01', '2026-03-31');
    expect(result).toEqual([]);
  });
});

describe('SessionService.updateStatus', () => {
  it('marks a SCHEDULED session as COMPLETED', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-03-01',
      endDate: null,
    });
    const [created] = await service.generate(patient.id, '2026-03-02', '2026-03-02');
    const updated = await service.updateStatus(created!.id, { status: 'COMPLETED' });
    expect(updated.status).toBe('COMPLETED');
    expect(updated.id).toBe(created!.id);
  });

  it('marks a session as MISSED with a note', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-03-01',
      endDate: null,
    });
    const [created] = await service.generate(patient.id, '2026-03-02', '2026-03-02');
    const updated = await service.updateStatus(created!.id, {
      status: 'MISSED',
      note: 'paciente avisou',
    });
    expect(updated.status).toBe('MISSED');
    expect(updated.note).toBe('paciente avisou');
  });

  it('updates only the note when status is omitted', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-03-01',
      endDate: null,
    });
    const [created] = await service.generate(patient.id, '2026-03-02', '2026-03-02');
    const updated = await service.updateStatus(created!.id, { note: 'anotação' });
    expect(updated.status).toBe('SCHEDULED');
    expect(updated.note).toBe('anotação');
  });

  it('allows clearing the note by passing null', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-03-01',
      endDate: null,
    });
    const [created] = await service.generate(patient.id, '2026-03-02', '2026-03-02');
    await service.updateStatus(created!.id, { note: 'tmp' });
    const cleared = await service.updateStatus(created!.id, { note: null });
    expect(cleared.note).toBeNull();
  });

  it('allows transitioning between non-SCHEDULED statuses (correction)', async () => {
    const patient = await patients.create(samplePatient);
    await schedules.upsert({
      patientId: patient.id,
      weekdays: [1],
      startDate: '2026-03-01',
      endDate: null,
    });
    const [created] = await service.generate(patient.id, '2026-03-02', '2026-03-02');
    await service.updateStatus(created!.id, { status: 'COMPLETED' });
    const corrected = await service.updateStatus(created!.id, { status: 'MISSED' });
    expect(corrected.status).toBe('MISSED');
  });

  it('throws NotFoundError when the session does not exist', async () => {
    await expect(
      service.updateStatus('00000000-0000-0000-0000-000000000000', { status: 'COMPLETED' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
