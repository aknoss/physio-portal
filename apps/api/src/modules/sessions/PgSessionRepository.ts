import type { Pool } from 'pg';
import type { Session } from './Session.js';
import type { CreateSessionInput, SessionRepository } from './SessionRepository.js';
import type { SessionStatus } from '@physio-portal/contracts';

type SessionRow = {
  id: string;
  patient_id: string;
  date: string;
  status: SessionStatus;
  price_cents: number;
  note: string | null;
};

function mapRow(row: SessionRow): Session {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    status: row.status,
    priceCents: row.price_cents,
    note: row.note,
  };
}

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly pool: Pool) {}

  async bulkCreateScheduled(inputs: CreateSessionInput[]): Promise<Session[]> {
    if (inputs.length === 0) return [];
    const patientIds: string[] = [];
    const dates: string[] = [];
    const prices: number[] = [];
    for (const input of inputs) {
      patientIds.push(input.patientId);
      dates.push(input.date);
      prices.push(input.priceCents);
    }
    const result = await this.pool.query<SessionRow>(
      `INSERT INTO sessions (patient_id, date, price_cents)
       SELECT * FROM unnest($1::uuid[], $2::date[], $3::int[])
       ON CONFLICT (patient_id, date) DO NOTHING
       RETURNING id, patient_id, date, status, price_cents, note`,
      [patientIds, dates, prices],
    );
    return result.rows.map(mapRow);
  }

  async listByPatientInRange(
    patientId: string,
    from: string,
    to: string,
  ): Promise<Session[]> {
    const result = await this.pool.query<SessionRow>(
      `SELECT id, patient_id, date, status, price_cents, note
         FROM sessions
        WHERE patient_id = $1 AND date BETWEEN $2 AND $3
        ORDER BY date ASC`,
      [patientId, from, to],
    );
    return result.rows.map(mapRow);
  }
}
