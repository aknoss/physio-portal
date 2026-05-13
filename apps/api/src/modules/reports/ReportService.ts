import type {
  PatientRankingDto,
  PatientReportDto,
  ReportSummaryDto,
} from '@physio-portal/contracts';
import { basename } from 'node:path';
import type { Clock } from '../../shared/clock/Clock.js';
import { NotFoundError } from '../../shared/http/HttpError.js';
import { monthRangeFor, sumRealizadaCents } from '../../shared/pricing/billing.js';
import type { FileStorage } from '../../shared/storage/FileStorage.js';
import type { PdfRenderer } from '../../infra/pdf/PdfRenderer.js';
import type { PatientRepository } from '../patients/PatientRepository.js';
import type { UserRepository } from '../auth/UserRepository.js';
import type { SessionRepository } from '../sessions/SessionRepository.js';
import type { ReportRepository } from './ReportRepository.js';

export class ReportService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly patients: PatientRepository,
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly storage: FileStorage,
    private readonly pdf: PdfRenderer,
    private readonly clock: Clock,
  ) {}

  async summary(from: string, to: string): Promise<ReportSummaryDto> {
    const totals = await this.reports.summaryInRange(from, to);
    return { from, to, ...totals };
  }

  async ranking(from: string, to: string): Promise<PatientRankingDto> {
    return this.reports.rankingInRange(from, to);
  }

  async patientSummary(
    patientId: string,
    from: string,
    to: string,
  ): Promise<PatientReportDto> {
    const patient = await this.patients.findById(patientId);
    if (!patient) throw new NotFoundError('Patient not found');
    const totals = await this.reports.patientSummaryInRange(patientId, from, to);
    return { patientId, from, to, ...totals };
  }

  async monthlyReport(
    userId: string,
    patientId: string,
    month: string,
  ): Promise<Buffer> {
    const physio = await this.users.findById(userId);
    if (!physio) throw new NotFoundError('User not found');
    const patient = await this.patients.findById(patientId);
    if (!patient) throw new NotFoundError('Patient not found');

    const { from, to } = monthRangeFor(`${month}-01`);
    const all = await this.sessions.listByPatientInRange(patientId, from, to);
    const realizadas = all.filter((s) => s.status === 'REALIZADA');
    const totalCents = sumRealizadaCents(realizadas);

    let signature: Buffer | null = null;
    if (physio.signatureUrl) {
      signature = await this.storage.read(basename(physio.signatureUrl));
    }

    return this.pdf.renderMonthlyReport({
      physio: { fullName: physio.fullName, cref: physio.cref },
      signature,
      patient: {
        fullName: patient.fullName,
        address: patient.address,
        phone: patient.phone,
      },
      month,
      sessions: realizadas.map((s) => ({ date: s.date, priceCents: s.priceCents })),
      totalCents,
      issuedAt: this.clock.now(),
    });
  }
}
