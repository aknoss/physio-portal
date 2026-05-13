export type ReportTotals = {
  totalCents: number;
  sessionCount: number;
};

export type PatientRankingRow = {
  patientId: string;
  fullName: string;
  totalCents: number;
  sessionCount: number;
};

export interface ReportRepository {
  summaryInRange(from: string, to: string): Promise<ReportTotals>;
  patientSummaryInRange(
    patientId: string,
    from: string,
    to: string,
  ): Promise<ReportTotals>;
  rankingInRange(from: string, to: string): Promise<PatientRankingRow[]>;
}
