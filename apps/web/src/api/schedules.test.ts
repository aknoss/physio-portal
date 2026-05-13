import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { getSchedule, upsertSchedule } from './schedules';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

const SCHEDULE = {
  patientId: PATIENT_ID,
  weekdays: [1, 3],
  startDate: '2026-03-01',
  endDate: null,
};

describe('schedules api client', () => {
  it('getSchedule returns the schedule for a patient', async () => {
    server.use(
      http.get('/api/patients/:id/schedule', ({ params }) => {
        expect(params.id).toBe(PATIENT_ID);
        return HttpResponse.json(SCHEDULE);
      }),
    );
    const result = await getSchedule(PATIENT_ID);
    expect(result).toEqual(SCHEDULE);
  });

  it('getSchedule returns null on 404', async () => {
    server.use(
      http.get('/api/patients/:id/schedule', () =>
        HttpResponse.json({ error: 'not found' }, { status: 404 }),
      ),
    );
    const result = await getSchedule(PATIENT_ID);
    expect(result).toBeNull();
  });

  it('upsertSchedule sends a PUT with the body', async () => {
    let receivedBody: unknown = null;
    server.use(
      http.put('/api/patients/:id/schedule', async ({ request, params }) => {
        receivedBody = await request.json();
        expect(params.id).toBe(PATIENT_ID);
        return HttpResponse.json(SCHEDULE);
      }),
    );
    const result = await upsertSchedule(PATIENT_ID, {
      weekdays: [1, 3],
      startDate: '2026-03-01',
    });
    expect(result).toEqual(SCHEDULE);
    expect(receivedBody).toEqual({ weekdays: [1, 3], startDate: '2026-03-01' });
  });
});
