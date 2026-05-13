import type { Pool } from 'pg';
import type {
  PatientRankingRow,
  ReportRepository,
  ReportTotals,
} from './ReportRepository.js';

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
        WHERE status = 'COMPLETED'
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
        WHERE status = 'COMPLETED'
          AND patient_id = $1
          AND date BETWEEN $2 AND $3`,
      [patientId, from, to],
    );
    return mapRow(result.rows[0]!);
  }

  async rankingInRange(from: string, to: string): Promise<PatientRankingRow[]> {
    const result = await this.pool.query<{
      patient_id: string;
      full_name: string;
      total_cents: string;
      session_count: string;
    }>(
      `SELECT p.id AS patient_id,
              p.full_name,
              COALESCE(SUM(s.price_cents), 0)::bigint AS total_cents,
              COUNT(s.id)::bigint AS session_count
         FROM patients p
         JOIN sessions s ON s.patient_id = p.id
        WHERE s.status = 'COMPLETED'
          AND s.date BETWEEN $1 AND $2
        GROUP BY p.id, p.full_name
        ORDER BY total_cents DESC, p.full_name ASC`,
      [from, to],
    );
    return result.rows.map((row) => ({
      patientId: row.patient_id,
      fullName: row.full_name,
      totalCents: Number(row.total_cents),
      sessionCount: Number(row.session_count),
    }));
  }
}
