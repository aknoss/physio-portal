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
    ['fisio@example.com', passwordHash, 'Raiany', 'CREFITO-99999'],
  );
});

async function login(): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({
    email: 'fisio@example.com',
    password: PASSWORD,
  });
  return res.body.token as string;
}

async function createPatient(token: string): Promise<string> {
  const res = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${token}`)
    .send({
      fullName: 'Raiany',
      address: 'Rua A, 123',
      phone: '+5521987654321',
      sessionPriceCents: 12000,
      notes: null,
    });
  return res.body.id as string;
}

describe('Schedule routes — auth', () => {
  it('PUT /patients/:id/schedule requires a token', async () => {
    const res = await request(app)
      .put('/api/patients/00000000-0000-0000-0000-000000000000/schedule')
      .send({ weekdays: [1], startDate: '2026-01-01' });
    expect(res.status).toBe(401);
  });
});

describe('PUT /patients/:id/schedule', () => {
  it('upserts a schedule and returns the dto', async () => {
    const token = await login();
    const patientId = await createPatient(token);
    const res = await request(app)
      .put(`/api/patients/${patientId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weekdays: [1, 3, 5], startDate: '2026-03-01' });
    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe(patientId);
    expect(res.body.weekdays).toEqual([1, 3, 5]);
    expect(res.body.startDate).toBe('2026-03-01');
    expect(res.body.endDate).toBeNull();
  });

  it('overwrites the existing schedule', async () => {
    const token = await login();
    const patientId = await createPatient(token);
    await request(app)
      .put(`/api/patients/${patientId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weekdays: [1], startDate: '2026-01-01' });
    const res = await request(app)
      .put(`/api/patients/${patientId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weekdays: [2, 4], startDate: '2026-04-01', endDate: '2026-12-31' });
    expect(res.body.weekdays).toEqual([2, 4]);
    expect(res.body.endDate).toBe('2026-12-31');
  });

  it('accepts an explicit null endDate', async () => {
    const token = await login();
    const patientId = await createPatient(token);
    const res = await request(app)
      .put(`/api/patients/${patientId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weekdays: [1], startDate: '2026-01-01', endDate: null });
    expect(res.body.endDate).toBeNull();
  });

  it('returns 400 when weekdays are out of range', async () => {
    const token = await login();
    const patientId = await createPatient(token);
    const res = await request(app)
      .put(`/api/patients/${patientId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weekdays: [7], startDate: '2026-01-01' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when weekdays are duplicated', async () => {
    const token = await login();
    const patientId = await createPatient(token);
    const res = await request(app)
      .put(`/api/patients/${patientId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weekdays: [1, 1], startDate: '2026-01-01' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when endDate is before startDate', async () => {
    const token = await login();
    const patientId = await createPatient(token);
    const res = await request(app)
      .put(`/api/patients/${patientId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weekdays: [1], startDate: '2026-03-15', endDate: '2026-03-01' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the patient does not exist', async () => {
    const token = await login();
    const res = await request(app)
      .put('/api/patients/00000000-0000-0000-0000-000000000000/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ weekdays: [1], startDate: '2026-01-01' });
    expect(res.status).toBe(404);
  });
});

describe('GET /patients/:id/schedule', () => {
  it('returns the schedule', async () => {
    const token = await login();
    const patientId = await createPatient(token);
    await request(app)
      .put(`/api/patients/${patientId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weekdays: [1], startDate: '2026-01-01' });
    const res = await request(app)
      .get(`/api/patients/${patientId}/schedule`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.weekdays).toEqual([1]);
  });

  it('returns 404 when the patient does not exist', async () => {
    const token = await login();
    const res = await request(app)
      .get('/api/patients/00000000-0000-0000-0000-000000000000/schedule')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when the patient has no schedule', async () => {
    const token = await login();
    const patientId = await createPatient(token);
    const res = await request(app)
      .get(`/api/patients/${patientId}/schedule`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
