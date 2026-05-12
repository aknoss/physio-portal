export type MonthlyReportInput = {
  physio: { fullName: string; cref: string };
  signature: Buffer | null;
  patient: { fullName: string; address: string; phone: string };
  month: string;
  sessions: ReadonlyArray<{ date: string; priceCents: number }>;
  totalCents: number;
  issuedAt: Date;
};

export interface PdfRenderer {
  renderMonthlyReport(input: MonthlyReportInput): Promise<Buffer>;
}
