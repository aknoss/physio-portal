export type ReportTotals = {
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
}
