import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../src/shared/http/HttpError.js';
import { ReportService } from '../../../src/modules/reports/ReportService.js';
import {
  FakeFileStorage,
  FixedClock,
  InMemoryPatientRepository,
  InMemoryReportRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
} from '../../helpers/fakes.js';
import type { PdfRenderer, MonthlyReportInput } from '../../../src/infra/pdf/PdfRenderer.js';

const samplePatient = {
  fullName: 'Raiany Silva',
  address: 'Rua A, 123',
  phone: '+5521987654321',
  sessionPriceCents: 12000,
  notes: null,
};

let patients: InMemoryPatientRepository;
let reports: InMemoryReportRepository;
let users: InMemoryUserRepository;
let sessions: InMemorySessionRepository;
let storage: FakeFileStorage;
let clock: FixedClock;
let pdf: PdfRenderer & { calls: MonthlyReportInput[] };
let service: ReportService;
let physioUserId: string;

function makeFakePdfRenderer(): PdfRenderer & { calls: MonthlyReportInput[] } {
  const calls: MonthlyReportInput[] = [];
  return {
    calls,
    async renderMonthlyReport(input) {
      calls.push(input);
      return Buffer.from(`pdf:${input.month}`);
    },
  };
}

beforeEach(async () => {
  patients = new InMemoryPatientRepository();
  reports = new InMemoryReportRepository();
  users = new InMemoryUserRepository();
  sessions = new InMemorySessionRepository();
  storage = new FakeFileStorage();
  clock = new FixedClock(new Date(Date.UTC(2026, 3, 1, 12, 0, 0)));
  pdf = makeFakePdfRenderer();
  const physio = await users.create({
    email: 'fisio@example.com',
    passwordHash: 'x',
    fullName: 'Dra. Raiany',
    cref: 'CREFITO-12345',
  });
  physioUserId = physio.id;
  service = new ReportService(reports, patients, users, sessions, storage, pdf, clock);
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

describe('ReportService.ranking', () => {
  it('returns the patient ranking from the repository', async () => {
    const a = await patients.create({ ...samplePatient, fullName: 'Ana' });
    const b = await patients.create({ ...samplePatient, fullName: 'Bruno' });
    reports.setRanking('2026-03-01', '2026-03-31', [
      { patientId: b.id, fullName: 'Bruno', totalCents: 36000, sessionCount: 3 },
      { patientId: a.id, fullName: 'Ana', totalCents: 24000, sessionCount: 2 },
    ]);
    const result = await service.ranking('2026-03-01', '2026-03-31');
    expect(result).toEqual([
      { patientId: b.id, fullName: 'Bruno', totalCents: 36000, sessionCount: 3 },
      { patientId: a.id, fullName: 'Ana', totalCents: 24000, sessionCount: 2 },
    ]);
  });

  it('returns an empty list when no patient billed in the range', async () => {
    const result = await service.ranking('2026-03-01', '2026-03-31');
    expect(result).toEqual([]);
  });
});

describe('ReportService.monthlyReport', () => {
  it('renders a PDF with patient, physio, REALIZADA sessions only, and the total', async () => {
    const patient = await patients.create(samplePatient);
    const created = await sessions.bulkCreateScheduled([
      { patientId: patient.id, date: '2026-03-02', priceCents: 12000 },
      { patientId: patient.id, date: '2026-03-09', priceCents: 12000 },
      { patientId: patient.id, date: '2026-03-16', priceCents: 12000 },
      { patientId: patient.id, date: '2026-03-23', priceCents: 12000 },
    ]);
    await sessions.update(created[0]!.id, { status: 'REALIZADA' });
    await sessions.update(created[1]!.id, { status: 'REALIZADA' });
    await sessions.update(created[2]!.id, { status: 'FALTA' });
    await sessions.update(created[3]!.id, { status: 'REMARCADA' });

    const buffer = await service.monthlyReport(physioUserId, patient.id, '2026-03');
    expect(buffer.toString()).toBe('pdf:2026-03');

    const call = pdf.calls[0]!;
    expect(call.month).toBe('2026-03');
    expect(call.physio).toEqual({ fullName: 'Dra. Raiany', cref: 'CREFITO-12345' });
    expect(call.patient).toEqual({
      fullName: patient.fullName,
      address: patient.address,
      phone: patient.phone,
    });
    expect(call.sessions.map((s) => s.date)).toEqual(['2026-03-02', '2026-03-09']);
    expect(call.totalCents).toBe(24000);
    expect(call.signature).toBeNull();
    expect(call.issuedAt).toEqual(clock.now());
  });

  it('embeds the signature when the physio has one', async () => {
    const patient = await patients.create(samplePatient);
    await storage.save(`signature-${physioUserId}.png`, Buffer.from('PNGBYTES'));
    await users.updateSignatureUrl(physioUserId, `/uploads/signature-${physioUserId}.png`);

    await service.monthlyReport(physioUserId, patient.id, '2026-03');
    expect(pdf.calls[0]!.signature?.toString()).toBe('PNGBYTES');
  });

  it('passes null signature when the signature file is missing', async () => {
    const patient = await patients.create(samplePatient);
    await users.updateSignatureUrl(physioUserId, `/uploads/signature-${physioUserId}.png`);
    // file was never saved to storage
    await service.monthlyReport(physioUserId, patient.id, '2026-03');
    expect(pdf.calls[0]!.signature).toBeNull();
  });

  it('throws NotFoundError when the patient does not exist', async () => {
    await expect(
      service.monthlyReport(
        physioUserId,
        '00000000-0000-0000-0000-000000000000',
        '2026-03',
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when the physio user does not exist', async () => {
    const patient = await patients.create(samplePatient);
    await expect(
      service.monthlyReport(
        '00000000-0000-0000-0000-000000000000',
        patient.id,
        '2026-03',
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns an empty session list and zero total when no REALIZADA in the month', async () => {
    const patient = await patients.create(samplePatient);
    await sessions.bulkCreateScheduled([
      { patientId: patient.id, date: '2026-03-02', priceCents: 12000 },
    ]);
    await service.monthlyReport(physioUserId, patient.id, '2026-03');
    expect(pdf.calls[0]!.sessions).toEqual([]);
    expect(pdf.calls[0]!.totalCents).toBe(0);
  });
});
