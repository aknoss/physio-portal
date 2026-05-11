import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { down, status, up } from '../../src/db/migrate.js';

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

async function makeMigrationsDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'physio-migs-'));
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(dir, name), contents, 'utf8');
  }
  return dir;
}

const init = {
  '0001_init.up.sql': 'CREATE TABLE patients (id SERIAL PRIMARY KEY, name TEXT);',
  '0001_init.down.sql': 'DROP TABLE patients;',
};

const addSessions = {
  '0002_add_sessions.up.sql': 'CREATE TABLE sessions (id SERIAL PRIMARY KEY);',
  '0002_add_sessions.down.sql': 'DROP TABLE sessions;',
};

describe('migration runner', () => {
  it('status: fresh DB lists every migration as pending in numeric order', async () => {
    const dir = await makeMigrationsDir({ ...init, ...addSessions });
    const result = await status({ pool, migrationsDir: dir });
    expect(result).toEqual({
      applied: [],
      pending: ['0001_init', '0002_add_sessions'],
    });
  });

  it('up: applies pending migrations in numeric order and records them', async () => {
    const dir = await makeMigrationsDir({ ...init, ...addSessions });
    const result = await up({ pool, migrationsDir: dir });
    expect(result).toEqual({ applied: ['0001_init', '0002_add_sessions'] });

    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`,
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual(['_migrations', 'patients', 'sessions']);
  });

  it('up: is idempotent — re-running applies nothing', async () => {
    const dir = await makeMigrationsDir(init);
    await up({ pool, migrationsDir: dir });
    expect(await up({ pool, migrationsDir: dir })).toEqual({ applied: [] });
  });

  it('status: after up, applied is populated and pending is empty', async () => {
    const dir = await makeMigrationsDir({ ...init, ...addSessions });
    await up({ pool, migrationsDir: dir });
    expect(await status({ pool, migrationsDir: dir })).toEqual({
      applied: ['0001_init', '0002_add_sessions'],
      pending: [],
    });
  });

  it('down: reverts the most recently applied migration', async () => {
    const dir = await makeMigrationsDir({ ...init, ...addSessions });
    await up({ pool, migrationsDir: dir });
    expect(await down({ pool, migrationsDir: dir })).toEqual({ reverted: '0002_add_sessions' });
    expect(await status({ pool, migrationsDir: dir })).toEqual({
      applied: ['0001_init'],
      pending: ['0002_add_sessions'],
    });
  });

  it('down: returns reverted: null when nothing has been applied', async () => {
    const dir = await makeMigrationsDir(init);
    expect(await down({ pool, migrationsDir: dir })).toEqual({ reverted: null });
  });

  it('up: rolls back the transaction when a migration fails', async () => {
    const dir = await makeMigrationsDir({
      '0001_init.up.sql':
        'CREATE TABLE patients (id SERIAL PRIMARY KEY); INSERT INTO patients (id) VALUES (1/0);',
      '0001_init.down.sql': 'DROP TABLE patients;',
    });
    await expect(up({ pool, migrationsDir: dir })).rejects.toThrow();
    const patients = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patients'`,
    );
    expect(patients.rowCount).toBe(0);
    const applied = await pool.query(`SELECT name FROM _migrations`);
    expect(applied.rowCount).toBe(0);
  });

  it('down: rolls back the transaction when a down migration fails', async () => {
    const dir = await makeMigrationsDir({
      '0001_init.up.sql': 'CREATE TABLE patients (id SERIAL PRIMARY KEY);',
      '0001_init.down.sql': 'SELECT 1/0;',
    });
    await up({ pool, migrationsDir: dir });
    await expect(down({ pool, migrationsDir: dir })).rejects.toThrow();
    const applied = await pool.query<{ name: string }>(`SELECT name FROM _migrations`);
    expect(applied.rows.map((r) => r.name)).toEqual(['0001_init']);
  });

  it('throws when a migration filename does not match NNNN_<slug>.<up|down>.sql', async () => {
    const dir = await makeMigrationsDir({
      'badname.up.sql': 'SELECT 1;',
      'badname.down.sql': 'SELECT 1;',
    });
    await expect(status({ pool, migrationsDir: dir })).rejects.toThrow(/invalid migration filename/i);
  });

  it('throws when an up.sql has no matching down.sql', async () => {
    const dir = await makeMigrationsDir({
      '0001_init.up.sql': 'SELECT 1;',
    });
    await expect(status({ pool, migrationsDir: dir })).rejects.toThrow(/missing down\.sql/i);
  });

  it('throws when a down.sql has no matching up.sql', async () => {
    const dir = await makeMigrationsDir({
      '0001_init.down.sql': 'SELECT 1;',
    });
    await expect(status({ pool, migrationsDir: dir })).rejects.toThrow(/missing up\.sql/i);
  });

  it('sorts migrations numerically, not lexically', async () => {
    const dir = await makeMigrationsDir({
      '0002_b.up.sql': 'SELECT 1;',
      '0002_b.down.sql': 'SELECT 1;',
      '0010_c.up.sql': 'SELECT 1;',
      '0010_c.down.sql': 'SELECT 1;',
      '0001_a.up.sql': 'SELECT 1;',
      '0001_a.down.sql': 'SELECT 1;',
    });
    const result = await status({ pool, migrationsDir: dir });
    expect(result.pending).toEqual(['0001_a', '0002_b', '0010_c']);
  });

  it('ignores non-sql files in the migrations directory', async () => {
    const dir = await makeMigrationsDir({
      ...init,
      'README.md': 'notes',
      '.gitkeep': '',
    });
    const result = await status({ pool, migrationsDir: dir });
    expect(result.pending).toEqual(['0001_init']);
  });

  it('down: throws when the recorded migration is no longer present on disk', async () => {
    const dir = await makeMigrationsDir(init);
    await up({ pool, migrationsDir: dir });
    await unlink(join(dir, '0001_init.up.sql'));
    await unlink(join(dir, '0001_init.down.sql'));
    await expect(down({ pool, migrationsDir: dir })).rejects.toThrow(
      /recorded.*missing|missing.*disk/i,
    );
    await rm(dir, { recursive: true, force: true });
  });
});
