import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Express } from 'express';
import { applyMigrations, type PgFixture, startPostgres, stopPostgres } from '../../helpers/postgres.js';
import { buildApp } from '../../../src/container.js';

const JWT_SECRET = 'test-jwt-secret-please-do-not-reuse-irl';
const PASSWORD = 'senha123';

let fixture: PgFixture;
let uploadsDir: string;
let app: Express;
let passwordHash: string;

beforeAll(async () => {
  fixture = await startPostgres();
  await applyMigrations(fixture.pool);
  uploadsDir = await mkdtemp(join(tmpdir(), 'sigs-'));
  app = buildApp({
    pool: fixture.pool,
    jwtSecret: JWT_SECRET,
    uploadsDir,
    uploadsPublicPrefix: '/uploads',
  });
  passwordHash = await bcrypt.hash(PASSWORD, 10);
});

afterAll(async () => {
  await stopPostgres(fixture);
  await rm(uploadsDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await fixture.pool.query('TRUNCATE users CASCADE');
  await fixture.pool.query(
    `INSERT INTO users (email, password_hash, full_name, cref) VALUES ($1, $2, $3, $4)`,
    ['fisio@example.com', passwordHash, 'Dra. Raiany', 'CREFITO-99999'],
  );
});

async function login(): Promise<string> {
  const res = await request(app).post('/auth/login').send({
    email: 'fisio@example.com',
    password: PASSWORD,
  });
  return res.body.token as string;
}

describe('POST /auth/login', () => {
  it('returns 200 with token and user on valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'fisio@example.com',
      password: PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe('fisio@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'fisio@example.com',
      password: 'wrong',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 with issues on an invalid body', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'not-email' });
    expect(res.status).toBe(400);
    expect(res.body.issues).toBeInstanceOf(Array);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });
});

describe('GET /auth/me', () => {
  it('returns the user when a valid token is sent', async () => {
    const token = await login();
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('fisio@example.com');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the authenticated user no longer exists', async () => {
    const token = await login();
    await fixture.pool.query('TRUNCATE users CASCADE');
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /auth/me', () => {
  it('updates the profile and returns the new user', async () => {
    const token = await login();
    const res = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Dra. Raiany Silva', cref: 'CREFITO-99999-RJ' });
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Dra. Raiany Silva');
    expect(res.body.cref).toBe('CREFITO-99999-RJ');
  });

  it('returns 400 on invalid body', async () => {
    const token = await login();
    const res = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: '', cref: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/me/signature', () => {
  it('stores a PNG and updates signatureUrl', async () => {
    const token = await login();
    const res = await request(app)
      .post('/auth/me/signature')
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', Buffer.from('PNGDATA'), {
        filename: 'sig.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(200);
    expect(res.body.signatureUrl).toMatch(/^\/uploads\/signature-/);
  });

  it('returns 400 when no file is attached', async () => {
    const token = await login();
    const res = await request(app)
      .post('/auth/me/signature')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when the file is not a PNG', async () => {
    const token = await login();
    const res = await request(app)
      .post('/auth/me/signature')
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', Buffer.from('hello'), {
        filename: 'sig.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(400);
  });
});
