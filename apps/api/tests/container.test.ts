import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Express } from 'express';
import {
  applyMigrations,
  type PgFixture,
  startPostgres,
  stopPostgres,
} from './helpers/postgres.js';
import { buildApp } from '../src/container.js';

const JWT_SECRET = 'test-jwt-secret-please-do-not-reuse-irl';
const PASSWORD = 'senha123';

let fixture: PgFixture;
let uploadsDir: string;
let webDistDir: string;
let appWithSpa: Express;
let appWithoutSpa: Express;
let passwordHash: string;

beforeAll(async () => {
  fixture = await startPostgres();
  await applyMigrations(fixture.pool);
  uploadsDir = await mkdtemp(join(tmpdir(), 'uploads-'));
  webDistDir = await mkdtemp(join(tmpdir(), 'webdist-'));
  await writeFile(join(uploadsDir, 'sample.txt'), 'hello uploads');
  await writeFile(join(webDistDir, 'index.html'), '<html>spa root</html>');
  await writeFile(join(webDistDir, 'main.js'), 'console.log("asset");');
  passwordHash = await bcrypt.hash(PASSWORD, 10);

  appWithSpa = buildApp({
    pool: fixture.pool,
    jwtSecret: JWT_SECRET,
    uploadsDir,
    uploadsPublicPrefix: '/uploads',
    webDistDir,
  });

  appWithoutSpa = buildApp({
    pool: fixture.pool,
    jwtSecret: JWT_SECRET,
    uploadsDir,
    uploadsPublicPrefix: '/uploads',
  });
});

beforeEach(async () => {
  await fixture.pool.query('TRUNCATE users CASCADE');
  await fixture.pool.query(
    `INSERT INTO users (email, password_hash, full_name, cref) VALUES ($1, $2, $3, $4)`,
    ['fisio@example.com', passwordHash, 'Raiany', 'CREFITO-99999'],
  );
});

async function login(): Promise<string> {
  const res = await request(appWithSpa)
    .post('/api/auth/login')
    .send({ email: 'fisio@example.com', password: PASSWORD });
  return res.body.token as string;
}

afterAll(async () => {
  await stopPostgres(fixture);
  await rm(uploadsDir, { recursive: true, force: true });
  await rm(webDistDir, { recursive: true, force: true });
});

describe('uploads static serving', () => {
  it('serves files under the uploadsPublicPrefix', async () => {
    const res = await request(appWithSpa).get('/uploads/sample.txt');
    expect(res.status).toBe(200);
    expect(res.text).toBe('hello uploads');
  });
});

describe('/api routing', () => {
  it('returns JSON 404 for authenticated requests to unknown /api paths', async () => {
    const token = await login();
    const res = await request(appWithSpa)
      .get('/api/does-not-exist')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found' });
  });
});

describe('SPA fallback (when webDistDir set)', () => {
  it('serves index.html at GET /', async () => {
    const res = await request(appWithSpa).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('spa root');
  });

  it('serves real static assets directly', async () => {
    const res = await request(appWithSpa).get('/main.js');
    expect(res.status).toBe(200);
    expect(res.text).toContain('console.log');
  });

  it('falls back to index.html for unknown client routes', async () => {
    const res = await request(appWithSpa).get('/patients/some-deep-route');
    expect(res.status).toBe(200);
    expect(res.text).toContain('spa root');
  });

  it('does not serve index.html for non-GET requests', async () => {
    const res = await request(appWithSpa).post('/anything');
    expect(res.status).toBe(404);
  });
});

describe('SPA disabled (no webDistDir)', () => {
  it('returns 404 for unknown GET paths', async () => {
    const res = await request(appWithoutSpa).get('/');
    expect(res.status).toBe(404);
  });
});
