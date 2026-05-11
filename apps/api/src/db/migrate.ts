import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';

export type MigrateOptions = {
  pool: Pool;
  migrationsDir: string;
};

export type StatusResult = {
  applied: string[];
  pending: string[];
};

export type UpResult = { applied: string[] };
export type DownResult = { reverted: string | null };

type MigrationFile = {
  id: string;
  number: number;
  upPath: string;
  downPath: string;
};

const FILENAME = /^(\d+)_([a-z0-9_-]+)\.(up|down)\.sql$/;

async function discover(dir: string): Promise<MigrationFile[]> {
  const entries = await readdir(dir);
  const ups = new Map<string, { number: number; path: string }>();
  const downs = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.endsWith('.sql')) continue;
    const match = FILENAME.exec(entry);
    if (!match) throw new Error(`Invalid migration filename: ${entry}`);
    const num = match[1]!;
    const slug = match[2]!;
    const kind = match[3]!;
    const id = `${num}_${slug}`;
    const path = join(dir, entry);
    if (kind === 'up') ups.set(id, { number: Number.parseInt(num, 10), path });
    else downs.set(id, path);
  }
  const files: MigrationFile[] = [];
  for (const [id, info] of ups) {
    const downPath = downs.get(id);
    if (!downPath) throw new Error(`Missing down.sql for migration ${id}`);
    files.push({ id, number: info.number, upPath: info.path, downPath });
  }
  for (const id of downs.keys()) {
    if (!ups.has(id)) throw new Error(`Missing up.sql for migration ${id}`);
  }
  files.sort((a, b) => a.number - b.number);
  return files;
}

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedNames(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ name: string }>(`SELECT name FROM _migrations ORDER BY id`);
  return result.rows.map((r) => r.name);
}

export async function status(opts: MigrateOptions): Promise<StatusResult> {
  await ensureMigrationsTable(opts.pool);
  const files = await discover(opts.migrationsDir);
  const applied = await appliedNames(opts.pool);
  const appliedSet = new Set(applied);
  const pending = files.filter((f) => !appliedSet.has(f.id)).map((f) => f.id);
  return { applied, pending };
}

export async function up(opts: MigrateOptions): Promise<UpResult> {
  await ensureMigrationsTable(opts.pool);
  const files = await discover(opts.migrationsDir);
  const applied = new Set(await appliedNames(opts.pool));
  const newlyApplied: string[] = [];
  for (const file of files) {
    if (applied.has(file.id)) continue;
    const sql = await readFile(file.upPath, 'utf8');
    const client = await opts.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file.id]);
      await client.query('COMMIT');
      newlyApplied.push(file.id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return { applied: newlyApplied };
}

export async function down(opts: MigrateOptions): Promise<DownResult> {
  await ensureMigrationsTable(opts.pool);
  const files = await discover(opts.migrationsDir);
  const last = await opts.pool.query<{ name: string }>(
    `SELECT name FROM _migrations ORDER BY id DESC LIMIT 1`,
  );
  if (last.rowCount === 0) return { reverted: null };
  const name = last.rows[0]!.name;
  const file = files.find((f) => f.id === name);
  if (!file) {
    throw new Error(`Migration ${name} recorded in _migrations but missing on disk`);
  }
  const sql = await readFile(file.downPath, 'utf8');
  const client = await opts.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('DELETE FROM _migrations WHERE name = $1', [name]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { reverted: name };
}
