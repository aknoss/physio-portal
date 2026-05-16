import 'dotenv/config';
import { Pool } from 'pg';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { down, status, up } from './migrate.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, 'migrations');

const command = process.argv[2];
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

try {
  if (command === 'up') {
    const result = await up({ pool, migrationsDir });
    if (result.applied.length === 0) console.log('No pending migrations.');
    else for (const id of result.applied) console.log(`Applied ${id}`);
  } else if (command === 'down') {
    const result = await down({ pool, migrationsDir });
    if (result.reverted) console.log(`Reverted ${result.reverted}`);
    else console.log('Nothing to revert.');
  } else if (command === 'status') {
    const result = await status({ pool, migrationsDir });
    console.log(`Applied (${result.applied.length}):`);
    for (const id of result.applied) console.log(`  ${id}`);
    console.log(`Pending (${result.pending.length}):`);
    for (const id of result.pending) console.log(`  ${id}`);
  } else {
    console.error(`Unknown command: ${command}. Use one of: up, down, status`);
    process.exit(1);
  }
} finally {
  await pool.end();
}
