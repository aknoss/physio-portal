import type {
  PatientReportDto,
  ReportSummaryDto,
} from '@physio-portal/contracts';
import { NotFoundError } from '../../shared/http/HttpError.js';
import type { PatientRepository } from '../patients/PatientRepository.js';
import type { ReportRepository } from './ReportRepository.js';

export class ReportService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly patients: PatientRepository,
  ) {}

  async summary(from: string, to: string): Promise<ReportSummaryDto> {
    const totals = await this.reports.summaryInRange(from, to);
    return { from, to, ...totals };
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
}
