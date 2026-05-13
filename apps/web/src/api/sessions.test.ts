import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { generateSessions, listSessions, updateSession } from './sessions';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const SESSION_ID = '22222222-2222-2222-2222-222222222222';

const SESSION = {
  id: SESSION_ID,
  patientId: PATIENT_ID,
  date: '2026-03-02',
  status: 'SCHEDULED' as const,
  priceCents: 12000,
  note: null,
};

describe('sessions api client', () => {
  it('listSessions forwards from/to as query params', async () => {
    let receivedUrl = '';
    server.use(
      http.get('/api/patients/:id/sessions', ({ request, params }) => {
        receivedUrl = request.url;
        expect(params.id).toBe(PATIENT_ID);
        return HttpResponse.json([SESSION]);
      }),
    );
    const result = await listSessions(PATIENT_ID, '2026-03-01', '2026-03-31');
    expect(result).toEqual([SESSION]);
    const url = new URL(receivedUrl);
    expect(url.searchParams.get('from')).toBe('2026-03-01');
    expect(url.searchParams.get('to')).toBe('2026-03-31');
  });

  it('generateSessions POSTs the body and returns the created sessions', async () => {
    let receivedBody: unknown = null;
    server.use(
      http.post('/api/patients/:id/sessions/generate', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json([SESSION], { status: 201 });
      }),
    );
    const result = await generateSessions(PATIENT_ID, '2026-03-01', '2026-03-31');
    expect(result).toEqual([SESSION]);
    expect(receivedBody).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });

  it('updateSession PATCHes the session', async () => {
    let receivedBody: unknown = null;
    server.use(
      http.patch('/api/sessions/:id', async ({ request, params }) => {
        receivedBody = await request.json();
        expect(params.id).toBe(SESSION_ID);
        return HttpResponse.json({ ...SESSION, status: 'COMPLETED' });
      }),
    );
    const result = await updateSession(SESSION_ID, { status: 'COMPLETED' });
    expect(result.status).toBe('COMPLETED');
    expect(receivedBody).toEqual({ status: 'COMPLETED' });
  });
});
