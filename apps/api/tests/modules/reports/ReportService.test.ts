import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../src/shared/http/HttpError.js';
import { ReportService } from '../../../src/modules/reports/ReportService.js';
import {
  InMemoryPatientRepository,
  InMemoryReportRepository,
} from '../../helpers/fakes.js';

const samplePatient = {
  fullName: 'Raiany Silva',
  address: 'Rua A, 123',
  phone: '+5521987654321',
  sessionPriceCents: 12000,
  notes: null,
};

let patients: InMemoryPatientRepository;
let reports: InMemoryReportRepository;
let service: ReportService;

beforeEach(() => {
  patients = new InMemoryPatientRepository();
  reports = new InMemoryReportRepository();
  service = new ReportService(reports, patients);
});

describe('ReportService.summary', () => {
  it('returns totals from the repository wrapped in the DTO shape', async () => {
    reports.setSummary('2026-03-01', '2026-03-31', { totalCents: 48000, sessionCount: 4 });
    const result = await service.summary('2026-03-01', '2026-03-31');
    expect(result).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
      totalCents: 48000,
      sessionCount: 4,
    });
  });

  it('returns zeros when there are no sessions', async () => {
    const result = await service.summary('2026-03-01', '2026-03-31');
    expect(result).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
      totalCents: 0,
      sessionCount: 0,
    });
  });
});

describe('ReportService.patientSummary', () => {
  it('returns the per-patient totals', async () => {
    const patient = await patients.create(samplePatient);
    reports.setPatientSummary(patient.id, '2026-03-01', '2026-03-31', {
      totalCents: 36000,
      sessionCount: 3,
    });
    const result = await service.patientSummary(patient.id, '2026-03-01', '2026-03-31');
    expect(result).toEqual({
      patientId: patient.id,
      from: '2026-03-01',
      to: '2026-03-31',
      totalCents: 36000,
      sessionCount: 3,
    });
  });

  it('throws NotFoundError when the patient does not exist', async () => {
    await expect(
      service.patientSummary(
        '00000000-0000-0000-0000-000000000000',
        '2026-03-01',
        '2026-03-31',
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
