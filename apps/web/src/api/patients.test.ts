import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import {
  createPatient,
  deactivatePatient,
  getPatient,
  listPatients,
  updatePatient,
} from './patients';

const SAMPLE = {
  id: '11111111-1111-1111-1111-111111111111',
  fullName: 'João da Silva',
  address: 'Rua A, 100',
  phone: '+5521987654321',
  sessionPriceCents: 12000,
  notes: null,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('patients api client', () => {
  it('listPatients sends no params when filter is empty', async () => {
    let receivedUrl = '';
    server.use(
      http.get('/api/patients', ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json([SAMPLE]);
      }),
    );
    const result = await listPatients();
    expect(result).toEqual([SAMPLE]);
    const url = new URL(receivedUrl);
    expect(url.searchParams.get('active')).toBeNull();
    expect(url.searchParams.get('search')).toBeNull();
  });

  it('listPatients forwards active and search params', async () => {
    let receivedUrl = '';
    server.use(
      http.get('/api/patients', ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    await listPatients({ active: false, search: 'jo' });
    const url = new URL(receivedUrl);
    expect(url.searchParams.get('active')).toBe('false');
    expect(url.searchParams.get('search')).toBe('jo');
  });

  it('getPatient fetches by id', async () => {
    server.use(
      http.get('/api/patients/:id', ({ params }) => {
        expect(params.id).toBe(SAMPLE.id);
        return HttpResponse.json(SAMPLE);
      }),
    );
    const result = await getPatient(SAMPLE.id);
    expect(result).toEqual(SAMPLE);
  });

  it('createPatient posts the body and returns the created patient', async () => {
    let receivedBody: unknown = null;
    server.use(
      http.post('/api/patients', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(SAMPLE, { status: 201 });
      }),
    );
    const result = await createPatient({
      fullName: 'João da Silva',
      address: 'Rua A, 100',
      phone: '+5521987654321',
      sessionPriceCents: 12000,
      notes: null,
    });
    expect(result).toEqual(SAMPLE);
    expect(receivedBody).toEqual({
      fullName: 'João da Silva',
      address: 'Rua A, 100',
      phone: '+5521987654321',
      sessionPriceCents: 12000,
      notes: null,
    });
  });

  it('updatePatient patches the resource', async () => {
    let receivedBody: unknown = null;
    server.use(
      http.patch('/api/patients/:id', async ({ request, params }) => {
        receivedBody = await request.json();
        expect(params.id).toBe(SAMPLE.id);
        return HttpResponse.json({ ...SAMPLE, fullName: 'João Novo' });
      }),
    );
    const result = await updatePatient(SAMPLE.id, { fullName: 'João Novo' });
    expect(result.fullName).toBe('João Novo');
    expect(receivedBody).toEqual({ fullName: 'João Novo' });
  });

  it('deactivatePatient hits DELETE /patients/:id', async () => {
    server.use(
      http.delete('/api/patients/:id', ({ params }) => {
        expect(params.id).toBe(SAMPLE.id);
        return HttpResponse.json({ ...SAMPLE, active: false });
      }),
    );
    const result = await deactivatePatient(SAMPLE.id);
    expect(result.active).toBe(false);
  });
});
