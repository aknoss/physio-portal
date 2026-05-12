import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Express } from 'express';
import {
  applyMigrations,
  type PgFixture,
  startPostgres,
  stopPostgres,
} from '../../helpers/postgres.js';
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
  await fixture.pool.query('TRUNCATE patients CASCADE');
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

const validBody = {
  fullName: 'Raiany Silva',
  address: 'Rua A, 123',
  phone: '+5521987654321',
  sessionPriceCents: 12000,
  notes: null as string | null,
};

describe('Patients routes — auth', () => {
  it('GET /patients requires a token', async () => {
    const res = await request(app).get('/patients');
    expect(res.status).toBe(401);
  });
});

describe('POST /patients', () => {
  it('creates a patient and returns 201 with the dto', async () => {
    const token = await login();
    const res = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.fullName).toBe(validBody.fullName);
    expect(res.body.active).toBe(true);
    expect(typeof res.body.createdAt).toBe('string');
  });

  it('returns 400 when phone is not in E.164 BR format', async () => {
    const token = await login();
    const res = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, phone: '21987654321' });
    expect(res.status).toBe(400);
    expect(res.body.issues).toBeInstanceOf(Array);
  });

  it('returns 400 when required fields are missing', async () => {
    const token = await login();
    const res = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: '' });
    expect(res.status).toBe(400);
  });
});

describe('GET /patients', () => {
  it('lists all patients ordered by name', async () => {
    const token = await login();
    await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, fullName: 'Bruno' });
    await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, fullName: 'Ana' });
    const res = await request(app).get('/patients').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((p: { fullName: string }) => p.fullName)).toEqual(['Ana', 'Bruno']);
  });

  it('filters by active=false', async () => {
    const token = await login();
    const created = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    await request(app)
      .delete(`/patients/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    const inactive = await request(app)
      .get('/patients?active=false')
      .set('Authorization', `Bearer ${token}`);
    expect(inactive.body).toHaveLength(1);
    const active = await request(app)
      .get('/patients?active=true')
      .set('Authorization', `Bearer ${token}`);
    expect(active.body).toHaveLength(0);
  });

  it('searches by name', async () => {
    const token = await login();
    await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, fullName: 'Ana Souza' });
    await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, fullName: 'Bruno Lima' });
    const res = await request(app)
      .get('/patients?search=bru')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.map((p: { fullName: string }) => p.fullName)).toEqual(['Bruno Lima']);
  });

  it('returns 400 when query is invalid', async () => {
    const token = await login();
    const res = await request(app)
      .get('/patients?active=maybe')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /patients/:id', () => {
  it('returns the patient when found', async () => {
    const token = await login();
    const created = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    const res = await request(app)
      .get(`/patients/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it('returns 404 when the patient does not exist', async () => {
    const token = await login();
    const res = await request(app)
      .get('/patients/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /patients/:id', () => {
  it('updates the provided fields', async () => {
    const token = await login();
    const created = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    const res = await request(app)
      .patch(`/patients/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Outro Nome' });
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Outro Nome');
  });

  it('returns 400 when no fields are provided', async () => {
    const token = await login();
    const created = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    const res = await request(app)
      .patch(`/patients/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when the patient does not exist', async () => {
    const token = await login();
    const res = await request(app)
      .patch('/patients/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /patients/:id', () => {
  it('soft-deletes the patient (active=false) and returns 200', async () => {
    const token = await login();
    const created = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    const res = await request(app)
      .delete(`/patients/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it('returns 404 when the patient does not exist', async () => {
    const token = await login();
    const res = await request(app)
      .delete('/patients/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
