import 'dotenv/config';
import { Pool } from 'pg';
import { PgUserRepository } from '../modules/auth/PgUserRepository.js';
import { BcryptPasswordHasher } from '../shared/crypto/BcryptPasswordHasher.js';
import { seed } from './seed.js';

const required = ['DATABASE_URL', 'SEED_EMAIL', 'SEED_PASSWORD', 'SEED_FULL_NAME', 'SEED_CREF'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`${key} is not set`);
    process.exit(1);
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const users = new PgUserRepository(pool);
const hasher = new BcryptPasswordHasher();

try {
  const result = await seed(users, hasher, {
    email: process.env.SEED_EMAIL!,
    password: process.env.SEED_PASSWORD!,
    fullName: process.env.SEED_FULL_NAME!,
    cref: process.env.SEED_CREF!,
  });
  console.log(`Seed ${result.action}: ${process.env.SEED_EMAIL}`);
} finally {
  await pool.end();
}
