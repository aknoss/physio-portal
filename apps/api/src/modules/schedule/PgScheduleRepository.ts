import type { Pool } from 'pg';
import type { Schedule } from './Schedule.js';
import type { ScheduleRepository, UpsertScheduleInput } from './ScheduleRepository.js';

type ScheduleRow = {
  patient_id: string;
  weekdays: number[];
  start_date: string;
  end_date: string | null;
};

function mapRow(row: ScheduleRow): Schedule {
  return {
    patientId: row.patient_id,
    weekdays: row.weekdays,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

export class PgScheduleRepository implements ScheduleRepository {
  constructor(private readonly pool: Pool) {}

  async upsert(input: UpsertScheduleInput): Promise<Schedule> {
    const result = await this.pool.query<ScheduleRow>(
      `INSERT INTO schedules (patient_id, weekdays, start_date, end_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (patient_id) DO UPDATE
         SET weekdays = EXCLUDED.weekdays,
             start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date
       RETURNING patient_id, weekdays, start_date, end_date`,
      [input.patientId, input.weekdays, input.startDate, input.endDate],
    );
    return mapRow(result.rows[0]!);
  }

  async findByPatientId(patientId: string): Promise<Schedule | null> {
    const result = await this.pool.query<ScheduleRow>(
      `SELECT patient_id, weekdays, start_date, end_date FROM schedules WHERE patient_id = $1`,
      [patientId],
    );
    return result.rowCount === 0 ? null : mapRow(result.rows[0]!);
  }
}
