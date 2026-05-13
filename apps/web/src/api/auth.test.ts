import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { updateProfile, uploadSignature } from './auth';

const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'pt@example.com',
  fullName: 'Dra. Ana',
  cref: 'CREFITO-123',
  signatureUrl: null,
};

describe('auth api client', () => {
  it('updateProfile sends PATCH /auth/me with fullName and cref', async () => {
    let received: unknown = null;
    server.use(
      http.patch('/api/auth/me', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ ...USER, fullName: 'Dra. Maria', cref: 'CREFITO-999' });
      }),
    );
    const result = await updateProfile({ fullName: 'Dra. Maria', cref: 'CREFITO-999' });
    expect(result.fullName).toBe('Dra. Maria');
    expect(received).toEqual({ fullName: 'Dra. Maria', cref: 'CREFITO-999' });
  });

  it('uploadSignature posts to /auth/me/signature and returns the updated user', async () => {
    let hit = false;
    server.use(
      http.post('/api/auth/me/signature', () => {
        hit = true;
        return HttpResponse.json({ ...USER, signatureUrl: '/uploads/sig.png' });
      }),
    );
    const file = new File([new Uint8Array([1, 2, 3])], 'sig.png', {
      type: 'image/png',
    });
    const result = await uploadSignature(file);
    expect(hit).toBe(true);
    expect(result.signatureUrl).toBe('/uploads/sig.png');
  });
});
