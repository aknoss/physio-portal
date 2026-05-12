import type { Pool } from 'pg';
import type { ReportRepository, ReportTotals } from './ReportRepository.js';

type TotalsRow = {
  total_cents: string;
  session_count: string;
};

function mapRow(row: TotalsRow): ReportTotals {
  return {
    totalCents: Number(row.total_cents),
    sessionCount: Number(row.session_count),
  };
}

export class PgReportRepository implements ReportRepository {
  constructor(private readonly pool: Pool) {}

  async summaryInRange(from: string, to: string): Promise<ReportTotals> {
    const result = await this.pool.query<TotalsRow>(
      `SELECT COALESCE(SUM(price_cents), 0)::bigint AS total_cents,
              COUNT(*)::bigint AS session_count
         FROM sessions
        WHERE status = 'REALIZADA'
          AND date BETWEEN $1 AND $2`,
      [from, to],
    );
    return mapRow(result.rows[0]!);
  }

  async patientSummaryInRange(
    patientId: string,
    from: string,
    to: string,
  ): Promise<ReportTotals> {
    const result = await this.pool.query<TotalsRow>(
      `SELECT COALESCE(SUM(price_cents), 0)::bigint AS total_cents,
              COUNT(*)::bigint AS session_count
         FROM sessions
        WHERE status = 'REALIZADA'
          AND patient_id = $1
          AND date BETWEEN $2 AND $3`,
      [patientId, from, to],
    );
    return mapRow(result.rows[0]!);
  }
}
