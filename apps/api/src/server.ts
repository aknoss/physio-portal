import 'dotenv/config';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { buildApp } from './container.js';

const here = dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
if (!jwtSecret) {
  console.error('JWT_SECRET is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const app = buildApp({
  pool,
  jwtSecret,
  uploadsDir: join(here, '../uploads'),
  uploadsPublicPrefix: '/uploads',
});

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
app.listen(port, () => {
  console.log(`api listening on :${port}`);
});
