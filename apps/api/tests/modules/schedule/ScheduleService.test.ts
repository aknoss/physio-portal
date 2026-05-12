import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../src/shared/http/HttpError.js';
import { ScheduleService } from '../../../src/modules/schedule/ScheduleService.js';
import {
  InMemoryPatientRepository,
  InMemoryScheduleRepository,
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
let service: ScheduleService;

beforeEach(() => {
  patients = new InMemoryPatientRepository();
  schedules = new InMemoryScheduleRepository();
  service = new ScheduleService(schedules, patients);
});

describe('ScheduleService', () => {
  it('upsert creates a schedule for an existing patient', async () => {
    const patient = await patients.create(samplePatient);
    const schedule = await service.upsert(patient.id, {
      weekdays: [1, 3, 5],
      startDate: '2026-03-01',
      endDate: null,
    });
    expect(schedule.patientId).toBe(patient.id);
    expect(schedule.weekdays).toEqual([1, 3, 5]);
    expect(schedule.startDate).toBe('2026-03-01');
    expect(schedule.endDate).toBeNull();
  });

  it('upsert overwrites the existing schedule for the patient', async () => {
    const patient = await patients.create(samplePatient);
    await service.upsert(patient.id, {
      weekdays: [1],
      startDate: '2026-01-01',
      endDate: null,
    });
    const updated = await service.upsert(patient.id, {
      weekdays: [2, 4],
      startDate: '2026-03-15',
      endDate: '2026-12-31',
    });
    expect(updated.weekdays).toEqual([2, 4]);
    expect(updated.startDate).toBe('2026-03-15');
    expect(updated.endDate).toBe('2026-12-31');
  });

  it('upsert throws NotFoundError when patient does not exist', async () => {
    await expect(
      service.upsert('00000000-0000-0000-0000-000000000000', {
        weekdays: [1],
        startDate: '2026-01-01',
        endDate: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('getByPatientId returns the schedule when both patient and schedule exist', async () => {
    const patient = await patients.create(samplePatient);
    await service.upsert(patient.id, {
      weekdays: [1],
      startDate: '2026-01-01',
      endDate: null,
    });
    const schedule = await service.getByPatientId(patient.id);
    expect(schedule.patientId).toBe(patient.id);
  });

  it('getByPatientId throws NotFoundError when patient does not exist', async () => {
    await expect(
      service.getByPatientId('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('getByPatientId throws NotFoundError when patient has no schedule', async () => {
    const patient = await patients.create(samplePatient);
    await expect(service.getByPatientId(patient.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
