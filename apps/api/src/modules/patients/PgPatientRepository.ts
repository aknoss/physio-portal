import type { Pool } from 'pg';
import type { Patient } from './Patient.js';
import type {
  CreatePatientInput,
  ListPatientsFilter,
  PatientRepository,
  UpdatePatientInput,
} from './PatientRepository.js';

type PatientRow = {
  id: string;
  full_name: string;
  address: string;
  phone: string;
  session_price_cents: number;
  notes: string | null;
  active: boolean;
  created_at: Date;
};

function mapRow(row: PatientRow): Patient {
  return {
    id: row.id,
    fullName: row.full_name,
    address: row.address,
    phone: row.phone,
    sessionPriceCents: row.session_price_cents,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
  };
}

const FIELD_COLUMNS: Record<keyof UpdatePatientInput, string> = {
  fullName: 'full_name',
  address: 'address',
  phone: 'phone',
  sessionPriceCents: 'session_price_cents',
  notes: 'notes',
  active: 'active',
};

export class PgPatientRepository implements PatientRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreatePatientInput): Promise<Patient> {
    const result = await this.pool.query<PatientRow>(
      `INSERT INTO patients (full_name, address, phone, session_price_cents, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.fullName, input.address, input.phone, input.sessionPriceCents, input.notes],
    );
    return mapRow(result.rows[0]!);
  }

  async findById(id: string): Promise<Patient | null> {
    const result = await this.pool.query<PatientRow>(`SELECT * FROM patients WHERE id = $1`, [id]);
    return result.rowCount === 0 ? null : mapRow(result.rows[0]!);
  }

  async list(filter: ListPatientsFilter): Promise<Patient[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (filter.active !== undefined) {
      values.push(filter.active);
      where.push(`active = $${values.length}`);
    }
    if (filter.search !== undefined) {
      values.push(`%${filter.search}%`);
      where.push(`full_name ILIKE $${values.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.pool.query<PatientRow>(
      `SELECT * FROM patients ${clause} ORDER BY full_name ASC`,
      values,
    );
    return result.rows.map(mapRow);
  }

  async update(id: string, input: UpdatePatientInput): Promise<Patient | null> {
    const sets: string[] = [];
    const values: unknown[] = [id];
    for (const key of Object.keys(input) as (keyof UpdatePatientInput)[]) {
      const value = input[key];
      if (value === undefined) continue;
      values.push(value);
      sets.push(`${FIELD_COLUMNS[key]} = $${values.length}`);
    }
    if (sets.length === 0) {
      return this.findById(id);
    }
    const result = await this.pool.query<PatientRow>(
      `UPDATE patients SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    return result.rowCount === 0 ? null : mapRow(result.rows[0]!);
  }

  async deactivate(id: string): Promise<Patient | null> {
    const result = await this.pool.query<PatientRow>(
      `UPDATE patients SET active = false WHERE id = $1 RETURNING *`,
      [id],
    );
    return result.rowCount === 0 ? null : mapRow(result.rows[0]!);
  }
}
