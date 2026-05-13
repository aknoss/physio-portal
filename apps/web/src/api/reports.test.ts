import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { getPatientSummary, getSummary } from './reports';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

describe('reports api client', () => {
  it('getSummary forwards from/to and returns the summary', async () => {
    let receivedUrl = '';
    server.use(
      http.get('/api/reports/summary', ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json({
          from: '2026-03-01',
          to: '2026-03-31',
          totalCents: 60000,
          sessionCount: 5,
        });
      }),
    );
    const result = await getSummary('2026-03-01', '2026-03-31');
    expect(result.totalCents).toBe(60000);
    expect(result.sessionCount).toBe(5);
    const url = new URL(receivedUrl);
    expect(url.searchParams.get('from')).toBe('2026-03-01');
    expect(url.searchParams.get('to')).toBe('2026-03-31');
  });

  it('getPatientSummary forwards from/to for a specific patient', async () => {
    let receivedUrl = '';
    server.use(
      http.get('/api/reports/patient/:id', ({ request, params }) => {
        receivedUrl = request.url;
        expect(params.id).toBe(PATIENT_ID);
        return HttpResponse.json({
          patientId: PATIENT_ID,
          from: '2026-03-01',
          to: '2026-03-31',
          totalCents: 36000,
          sessionCount: 3,
        });
      }),
    );
    const result = await getPatientSummary(PATIENT_ID, '2026-03-01', '2026-03-31');
    expect(result.totalCents).toBe(36000);
    expect(result.sessionCount).toBe(3);
    const url = new URL(receivedUrl);
    expect(url.searchParams.get('from')).toBe('2026-03-01');
    expect(url.searchParams.get('to')).toBe('2026-03-31');
  });
});
