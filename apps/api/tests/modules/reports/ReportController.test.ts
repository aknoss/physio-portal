import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Express } from 'express';

const requireCjs = createRequire(import.meta.url);
const { PDFParse } = requireCjs('pdf-parse') as {
  PDFParse: new (options: { data: Buffer }) => {
    getText(): Promise<{ text: string }>;
  };
};

async function extractText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  return text;
}

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
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
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'fisio@example.com', password: PASSWORD });
  return res.body.token as string;
}

async function createPatient(token: string, fullName = 'Raiany'): Promise<string> {
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
  status: 'COMPLETED' | 'MISSED' | 'RESCHEDULED',
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
    await generateAndMarkAll(token, a, '2026-03-01', '2026-03-31', 'COMPLETED');
    await generateAndMarkAll(token, b, '2026-03-01', '2026-03-31', 'COMPLETED');
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

describe('GET /reports/ranking', () => {
  it('requires a token', async () => {
    const res = await request(app).get('/reports/ranking?from=2026-03-01&to=2026-03-31');
    expect(res.status).toBe(401);
  });

  it('returns patients ordered by COMPLETED total desc', async () => {
    const token = await login();
    const a = await createPatient(token, 'Ana');
    const b = await createPatient(token, 'Bruno');
    await setupSchedule(token, a, [1], '2026-01-01');
    await setupSchedule(token, b, [1, 3], '2026-01-01');
    await generateAndMarkAll(token, a, '2026-03-01', '2026-03-31', 'COMPLETED');
    await generateAndMarkAll(token, b, '2026-03-01', '2026-03-31', 'COMPLETED');
    const res = await request(app)
      .get('/reports/ranking?from=2026-03-01&to=2026-03-31')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { patientId: b, fullName: 'Bruno', totalCents: 12000 * 9, sessionCount: 9 },
      { patientId: a, fullName: 'Ana', totalCents: 12000 * 5, sessionCount: 5 },
    ]);
  });

  it('returns an empty array when no patient billed in the range', async () => {
    const token = await login();
    const res = await request(app)
      .get('/reports/ranking?from=2026-03-01&to=2026-03-31')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 400 when from is after to', async () => {
    const token = await login();
    const res = await request(app)
      .get('/reports/ranking?from=2026-04-01&to=2026-03-01')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /reports/patient/:id', () => {
  it('returns per-patient totals for the range', async () => {
    const token = await login();
    const id = await createPatient(token);
    await setupSchedule(token, id, [1], '2026-01-01');
    await generateAndMarkAll(token, id, '2026-03-01', '2026-03-31', 'COMPLETED');
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

describe('GET /reports/patient/:id/monthly.pdf', () => {
  it('requires a token', async () => {
    const res = await request(app).get(
      '/reports/patient/00000000-0000-0000-0000-000000000000/monthly.pdf?month=2026-03',
    );
    expect(res.status).toBe(401);
  });

  it('returns the monthly PDF with the right headers and embedded text', async () => {
    const token = await login();
    const patientId = await createPatient(token, 'Pedro Silva');
    await setupSchedule(token, patientId, [1], '2026-01-01');
    await generateAndMarkAll(token, patientId, '2026-03-01', '2026-03-31', 'COMPLETED');

    const res = await request(app)
      .get(`/reports/patient/${patientId}/monthly.pdf?month=2026-03`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((response, callback) => {
        const data: Buffer[] = [];
        response.on('data', (chunk) => data.push(chunk as Buffer));
        response.on('end', () => callback(null, Buffer.concat(data)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('monthly-');
    const body = res.body as Buffer;
    expect(body.subarray(0, 4).toString()).toBe('%PDF');
    const text = await extractText(body);
    expect(text).toContain('Pedro Silva');
    expect(text).toContain('Raiany');
    expect(text).toContain('CREFITO-99999');
    expect(text).toContain('R$ 600,00'); // 5 sessions × R$120 in March 2026
  });

  it('embeds the uploaded signature when present', async () => {
    const token = await login();
    // upload signature
    await writeFile(join(uploadsDir, 'placeholder.txt'), ''); // ensure dir exists
    const sigRes = await request(app)
      .post('/auth/me/signature')
      .set('Authorization', `Bearer ${token}`)
      .attach('signature', ONE_PX_PNG, { filename: 'sig.png', contentType: 'image/png' });
    expect(sigRes.status).toBe(200);

    const patientId = await createPatient(token);
    await setupSchedule(token, patientId, [1], '2026-01-01');
    await generateAndMarkAll(token, patientId, '2026-03-01', '2026-03-31', 'COMPLETED');

    const res = await request(app)
      .get(`/reports/patient/${patientId}/monthly.pdf?month=2026-03`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((response, callback) => {
        const data: Buffer[] = [];
        response.on('data', (chunk) => data.push(chunk as Buffer));
        response.on('end', () => callback(null, Buffer.concat(data)));
      });

    expect(res.status).toBe(200);
    const body = res.body as Buffer;
    expect(body.includes(Buffer.from('/Image'))).toBe(true);
  });

  it('returns 400 when month is missing', async () => {
    const token = await login();
    const id = await createPatient(token);
    const res = await request(app)
      .get(`/reports/patient/${id}/monthly.pdf`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when month is malformed', async () => {
    const token = await login();
    const id = await createPatient(token);
    const res = await request(app)
      .get(`/reports/patient/${id}/monthly.pdf?month=2026-3`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the patient does not exist', async () => {
    const token = await login();
    const res = await request(app)
      .get(
        '/reports/patient/00000000-0000-0000-0000-000000000000/monthly.pdf?month=2026-03',
      )
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
