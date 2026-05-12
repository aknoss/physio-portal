import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../../src/db/pgTypes.js';
import { up } from '../../src/db/migrate.js';

const here = dirname(fileURLToPath(import.meta.url));
export const migrationsDir = join(here, '../../src/db/migrations');

export type PgFixture = {
  container: StartedPostgreSqlContainer;
  pool: Pool;
};

export async function startPostgres(): Promise<PgFixture> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });
  return { container, pool };
}

export async function stopPostgres({ pool, container }: PgFixture): Promise<void> {
  await pool.end();
  await container.stop();
}

export async function applyMigrations(pool: Pool): Promise<void> {
  await up({ pool, migrationsDir });
}
