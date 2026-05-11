import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { down, status, up } from '../../src/db/migrate.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '../../src/db/migrations');

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (container) await container.stop();
});

beforeEach(async () => {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
});

async function tableExists(name: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name],
  );
  return r.rowCount === 1;
}

async function enumExists(name: string): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM pg_type WHERE typname = $1`, [name]);
  return r.rowCount === 1;
}

describe('migration 0001_init', () => {
  it('up applies cleanly: includes all tables and the session_status enum', async () => {
    const result = await up({ pool, migrationsDir });
    expect(result.applied).toEqual(['0001_init']);

    expect(await tableExists('users')).toBe(true);
    expect(await tableExists('patients')).toBe(true);
    expect(await tableExists('schedules')).toBe(true);
    expect(await tableExists('sessions')).toBe(true);
    expect(await enumExists('session_status')).toBe(true);
  });

  it('users.email is unique', async () => {
    await up({ pool, migrationsDir });
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, cref) VALUES ('a@a.com', 'h', 'A', 'CR1')`,
    );
    await expect(
      pool.query(
        `INSERT INTO users (email, password_hash, full_name, cref) VALUES ('a@a.com', 'h', 'B', 'CR2')`,
      ),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('patients.session_price_cents rejects negative values', async () => {
    await up({ pool, migrationsDir });
    await expect(
      pool.query(
        `INSERT INTO patients (full_name, address, phone, session_price_cents)
         VALUES ('P', 'Rua A', '+5511999999999', -1)`,
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it('sessions enforces the session_status enum', async () => {
    await up({ pool, migrationsDir });
    const patient = await pool.query<{ id: string }>(
      `INSERT INTO patients (full_name, address, phone, session_price_cents)
       VALUES ('P', 'Rua A', '+5511999999999', 12000) RETURNING id`,
    );
    const patientId = patient.rows[0]!.id;
    await expect(
      pool.query(
        `INSERT INTO sessions (patient_id, date, status, price_cents) VALUES ($1, '2026-05-11', 'NOT_VALID', 12000)`,
        [patientId],
      ),
    ).rejects.toThrow(/invalid input value for enum/i);
  });

  it('sessions are unique per (patient_id, date)', async () => {
    await up({ pool, migrationsDir });
    const patient = await pool.query<{ id: string }>(
      `INSERT INTO patients (full_name, address, phone, session_price_cents)
       VALUES ('P', 'R', '+5511999999999', 12000) RETURNING id`,
    );
    const patientId = patient.rows[0]!.id;
    await pool.query(
      `INSERT INTO sessions (patient_id, date, status, price_cents) VALUES ($1, '2026-05-11', 'SCHEDULED', 12000)`,
      [patientId],
    );
    await expect(
      pool.query(
        `INSERT INTO sessions (patient_id, date, status, price_cents) VALUES ($1, '2026-05-11', 'SCHEDULED', 12000)`,
        [patientId],
      ),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('deleting a patient cascades to schedules and sessions', async () => {
    await up({ pool, migrationsDir });
    const patient = await pool.query<{ id: string }>(
      `INSERT INTO patients (full_name, address, phone, session_price_cents)
       VALUES ('P', 'R', '+5511999999999', 12000) RETURNING id`,
    );
    const patientId = patient.rows[0]!.id;
    await pool.query(
      `INSERT INTO schedules (patient_id, weekdays, start_date) VALUES ($1, ARRAY[1,3,5], '2026-05-01')`,
      [patientId],
    );
    await pool.query(
      `INSERT INTO sessions (patient_id, date, status, price_cents) VALUES ($1, '2026-05-11', 'SCHEDULED', 12000)`,
      [patientId],
    );
    await pool.query(`DELETE FROM patients WHERE id = $1`, [patientId]);
    const sch = await pool.query(`SELECT 1 FROM schedules WHERE patient_id = $1`, [patientId]);
    const ses = await pool.query(`SELECT 1 FROM sessions WHERE patient_id = $1`, [patientId]);
    expect(sch.rowCount).toBe(0);
    expect(ses.rowCount).toBe(0);
  });

  it('schedules.patient_id is unique (one schedule per patient)', async () => {
    await up({ pool, migrationsDir });
    const patient = await pool.query<{ id: string }>(
      `INSERT INTO patients (full_name, address, phone, session_price_cents)
       VALUES ('P', 'R', '+5511999999999', 12000) RETURNING id`,
    );
    const patientId = patient.rows[0]!.id;
    await pool.query(
      `INSERT INTO schedules (patient_id, weekdays, start_date) VALUES ($1, ARRAY[1], '2026-05-01')`,
      [patientId],
    );
    await expect(
      pool.query(
        `INSERT INTO schedules (patient_id, weekdays, start_date) VALUES ($1, ARRAY[2], '2026-05-01')`,
        [patientId],
      ),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('down drops all migration objects cleanly', async () => {
    await up({ pool, migrationsDir });
    const reverted = await down({ pool, migrationsDir });
    expect(reverted).toEqual({ reverted: '0001_init' });

    expect(await tableExists('users')).toBe(false);
    expect(await tableExists('patients')).toBe(false);
    expect(await tableExists('schedules')).toBe(false);
    expect(await tableExists('sessions')).toBe(false);
    expect(await enumExists('session_status')).toBe(false);
  });

  it('round-trip up → down → up succeeds', async () => {
    await up({ pool, migrationsDir });
    await down({ pool, migrationsDir });
    const second = await up({ pool, migrationsDir });
    expect(second.applied).toEqual(['0001_init']);
    const s = await status({ pool, migrationsDir });
    expect(s).toEqual({ applied: ['0001_init'], pending: [] });
  });
});
