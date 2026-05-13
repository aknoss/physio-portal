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

async function createPatientWithSchedule(
  token: string,
  weekdays: number[],
  startDate: string,
  endDate: string | null = null,
): Promise<string> {
  const created = await request(app)
    .post('/patients')
    .set('Authorization', `Bearer ${token}`)
    .send({
      fullName: 'Raiany Silva',
      address: 'Rua A, 123',
      phone: '+5521987654321',
      sessionPriceCents: 12000,
      notes: null,
    });
  const id = created.body.id as string;
  await request(app)
    .put(`/patients/${id}/schedule`)
    .set('Authorization', `Bearer ${token}`)
    .send({ weekdays, startDate, endDate });
  return id;
}

describe('Session generation routes — auth', () => {
  it('POST /patients/:id/sessions/generate requires a token', async () => {
    const res = await request(app)
      .post('/patients/00000000-0000-0000-0000-000000000000/sessions/generate')
      .send({ from: '2026-03-01', to: '2026-03-31' });
    expect(res.status).toBe(401);
  });
});

describe('POST /patients/:id/sessions/generate', () => {
  it('returns 201 and the generated SCHEDULED sessions', async () => {
    const token = await login();
    const id = await createPatientWithSchedule(token, [1], '2026-01-01');
    const res = await request(app)
      .post(`/patients/${id}/sessions/generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '2026-03-01', to: '2026-03-31' });
    expect(res.status).toBe(201);
    expect(res.body.map((s: { date: string }) => s.date)).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
      '2026-03-23',
      '2026-03-30',
    ]);
    expect(res.body.every((s: { status: string }) => s.status === 'SCHEDULED')).toBe(true);
    expect(res.body.every((s: { priceCents: number }) => s.priceCents === 12000)).toBe(true);
  });

  it('is idempotent — second call returns the same sessions without duplicates', async () => {
    const token = await login();
    const id = await createPatientWithSchedule(token, [1], '2026-01-01');
    await request(app)
      .post(`/patients/${id}/sessions/generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '2026-03-01', to: '2026-03-31' });
    const second = await request(app)
      .post(`/patients/${id}/sessions/generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '2026-03-01', to: '2026-03-31' });
    expect(second.status).toBe(201);
    expect(second.body).toHaveLength(5);
  });

  it('returns 400 when from is after to', async () => {
    const token = await login();
    const id = await createPatientWithSchedule(token, [1], '2026-01-01');
    const res = await request(app)
      .post(`/patients/${id}/sessions/generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '2026-04-01', to: '2026-03-01' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when dates are not ISO calendar dates', async () => {
    const token = await login();
    const id = await createPatientWithSchedule(token, [1], '2026-01-01');
    const res = await request(app)
      .post(`/patients/${id}/sessions/generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '2026/03/01', to: '2026-03-31' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the patient does not exist', async () => {
    const token = await login();
    const res = await request(app)
      .post('/patients/00000000-0000-0000-0000-000000000000/sessions/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '2026-03-01', to: '2026-03-31' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the patient has no schedule', async () => {
    const token = await login();
    const created = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Sem Agenda',
        address: 'Rua A',
        phone: '+5521987654321',
        sessionPriceCents: 12000,
        notes: null,
      });
    const res = await request(app)
      .post(`/patients/${created.body.id}/sessions/generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '2026-03-01', to: '2026-03-31' });
    expect(res.status).toBe(404);
  });
});

describe('GET /patients/:id/sessions', () => {
  it('requires a token', async () => {
    const res = await request(app)
      .get('/patients/00000000-0000-0000-0000-000000000000/sessions')
      .query({ from: '2026-03-01', to: '2026-03-31' });
    expect(res.status).toBe(401);
  });

  it('returns sessions inside the inclusive range, sorted by date', async () => {
    const token = await login();
    const id = await createPatientWithSchedule(token, [1, 3], '2026-01-01');
    await request(app)
      .post(`/patients/${id}/sessions/generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '2026-03-01', to: '2026-03-31' });
    const res = await request(app)
      .get(`/patients/${id}/sessions`)
      .set('Authorization', `Bearer ${token}`)
      .query({ from: '2026-03-04', to: '2026-03-11' });
    expect(res.status).toBe(200);
    expect(res.body.map((s: { date: string }) => s.date)).toEqual([
      '2026-03-04',
      '2026-03-09',
      '2026-03-11',
    ]);
    expect(res.body.every((s: { status: string }) => s.status === 'SCHEDULED')).toBe(true);
  });

  it('returns an empty array when there are no sessions in the range', async () => {
    const token = await login();
    const id = await createPatientWithSchedule(token, [1], '2026-01-01');
    const res = await request(app)
      .get(`/patients/${id}/sessions`)
      .set('Authorization', `Bearer ${token}`)
      .query({ from: '2026-03-01', to: '2026-03-31' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 400 when from is after to', async () => {
    const token = await login();
    const id = await createPatientWithSchedule(token, [1], '2026-01-01');
    const res = await request(app)
      .get(`/patients/${id}/sessions`)
      .set('Authorization', `Bearer ${token}`)
      .query({ from: '2026-04-01', to: '2026-03-01' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when dates are not ISO calendar dates', async () => {
    const token = await login();
    const id = await createPatientWithSchedule(token, [1], '2026-01-01');
    const res = await request(app)
      .get(`/patients/${id}/sessions`)
      .set('Authorization', `Bearer ${token}`)
      .query({ from: '2026/03/01', to: '2026-03-31' });
    expect(res.status).toBe(400);
  });
});

async function generateOne(token: string, patientId: string): Promise<string> {
  const res = await request(app)
    .post(`/patients/${patientId}/sessions/generate`)
    .set('Authorization', `Bearer ${token}`)
    .send({ from: '2026-03-02', to: '2026-03-02' });
  return res.body[0].id as string;
}

describe('PATCH /sessions/:id', () => {
  it('requires a token', async () => {
    const res = await request(app)
      .patch('/sessions/00000000-0000-0000-0000-000000000000')
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(401);
  });

  it('marks a session as COMPLETED', async () => {
    const token = await login();
    const patientId = await createPatientWithSchedule(token, [1], '2026-01-01');
    const sessionId = await generateOne(token, patientId);
    const res = await request(app)
      .patch(`/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.id).toBe(sessionId);
  });

  it('accepts a note alongside the status', async () => {
    const token = await login();
    const patientId = await createPatientWithSchedule(token, [1], '2026-01-01');
    const sessionId = await generateOne(token, patientId);
    const res = await request(app)
      .patch(`/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'MISSED', note: 'paciente avisou' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('MISSED');
    expect(res.body.note).toBe('paciente avisou');
  });

  it('returns 400 when no field is provided', async () => {
    const token = await login();
    const patientId = await createPatientWithSchedule(token, [1], '2026-01-01');
    const sessionId = await generateOne(token, patientId);
    const res = await request(app)
      .patch(`/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when status is SCHEDULED (not an allowed transition)', async () => {
    const token = await login();
    const patientId = await createPatientWithSchedule(token, [1], '2026-01-01');
    const sessionId = await generateOne(token, patientId);
    const res = await request(app)
      .patch(`/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SCHEDULED' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid status', async () => {
    const token = await login();
    const patientId = await createPatientWithSchedule(token, [1], '2026-01-01');
    const sessionId = await generateOne(token, patientId);
    const res = await request(app)
      .patch(`/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'NOPE' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the session does not exist', async () => {
    const token = await login();
    const res = await request(app)
      .patch('/sessions/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(404);
  });
});
