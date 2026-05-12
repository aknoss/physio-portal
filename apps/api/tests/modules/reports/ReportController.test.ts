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
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'fisio@example.com', password: PASSWORD });
  return res.body.token as string;
}

async function createPatient(token: string, fullName = 'Raiany Silva'): Promise<string> {
  const created = await request(app)
    .post('/patients')
    .set('Authorization', `Bearer ${token}`)
    .send({
      fullName,
      address: 'Rua A, 123',
      phone: '+5521987654321',
      sessionPriceCents: 12000,
      notes: null,
    });
  return created.body.id as string;
}

async function setupSchedule(
  token: string,
  patientId: string,
  weekdays: number[],
  startDate: string,
): Promise<void> {
  await request(app)
    .put(`/patients/${patientId}/schedule`)
    .set('Authorization', `Bearer ${token}`)
    .send({ weekdays, startDate, endDate: null });
}

async function generateAndMarkAll(
  token: string,
  patientId: string,
  from: string,
  to: string,
  status: 'REALIZADA' | 'FALTA' | 'REMARCADA',
): Promise<void> {
  const res = await request(app)
    .post(`/patients/${patientId}/sessions/generate`)
    .set('Authorization', `Bearer ${token}`)
    .send({ from, to });
  for (const s of res.body as { id: string }[]) {
    await request(app)
      .patch(`/sessions/${s.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status });
  }
}

describe('Report routes — auth', () => {
  it('GET /reports/summary requires a token', async () => {
    const res = await request(app).get('/reports/summary?from=2026-03-01&to=2026-03-31');
    expect(res.status).toBe(401);
  });

  it('GET /reports/patient/:id requires a token', async () => {
    const res = await request(app).get(
      '/reports/patient/00000000-0000-0000-0000-000000000000?from=2026-03-01&to=2026-03-31',
    );
    expect(res.status).toBe(401);
  });
});

describe('GET /reports/summary', () => {
  it('returns the overall totals for the range', async () => {
    const token = await login();
    const a = await createPatient(token, 'A');
    const b = await createPatient(token, 'B');
    await setupSchedule(token, a, [1], '2026-01-01');
    await setupSchedule(token, b, [3], '2026-01-01');
    await generateAndMarkAll(token, a, '2026-03-01', '2026-03-31', 'REALIZADA');
    await generateAndMarkAll(token, b, '2026-03-01', '2026-03-31', 'REALIZADA');
    const res = await request(app)
      .get('/reports/summary?from=2026-03-01&to=2026-03-31')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
      totalCents: 12000 * (5 + 4),
      sessionCount: 9,
    });
  });

  it('returns 400 when from > to', async () => {
    const token = await login();
    const res = await request(app)
      .get('/reports/summary?from=2026-04-01&to=2026-03-01')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when from or to is missing', async () => {
    const token = await login();
    const res = await request(app)
      .get('/reports/summary?from=2026-03-01')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /reports/patient/:id', () => {
  it('returns per-patient totals for the range', async () => {
    const token = await login();
    const id = await createPatient(token);
    await setupSchedule(token, id, [1], '2026-01-01');
    await generateAndMarkAll(token, id, '2026-03-01', '2026-03-31', 'REALIZADA');
    const res = await request(app)
      .get(`/reports/patient/${id}?from=2026-03-01&to=2026-03-31`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      patientId: id,
      from: '2026-03-01',
      to: '2026-03-31',
      totalCents: 12000 * 5,
      sessionCount: 5,
    });
  });

  it('returns 404 when the patient does not exist', async () => {
    const token = await login();
    const res = await request(app)
      .get(
        '/reports/patient/00000000-0000-0000-0000-000000000000?from=2026-03-01&to=2026-03-31',
      )
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when the query is invalid', async () => {
    const token = await login();
    const id = await createPatient(token);
    const res = await request(app)
      .get(`/reports/patient/${id}?from=2026/03/01&to=2026-03-31`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
