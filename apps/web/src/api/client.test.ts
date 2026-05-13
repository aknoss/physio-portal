import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import {
  clearToken,
  createApiClient,
  getToken,
  setToken,
} from './client';

describe('token storage', () => {
  beforeEach(() => clearToken());

  it('round-trips token through localStorage', () => {
    expect(getToken()).toBeNull();
    setToken('abc');
    expect(getToken()).toBe('abc');
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe('createApiClient', () => {
  it('attaches the bearer token to every request', async () => {
    setToken('tok-1');
    let received: string | null = null;
    server.use(
      http.get('http://api.test/ping', ({ request }) => {
        received = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );
    const client = createApiClient('http://api.test');
    await client.get('/ping');
    expect(received).toBe('Bearer tok-1');
  });

  it('omits the header when no token is stored', async () => {
    clearToken();
    let received: string | null = 'untouched';
    server.use(
      http.get('http://api.test/ping', ({ request }) => {
        received = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );
    const client = createApiClient('http://api.test');
    await client.get('/ping');
    expect(received).toBeNull();
  });

  it('clears the token on a 401 response', async () => {
    setToken('expired');
    server.use(
      http.get('http://api.test/protected', () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    );
    const client = createApiClient('http://api.test');
    await expect(client.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(getToken()).toBeNull();
  });

  it('does not clear the token on other error statuses', async () => {
    setToken('still-valid');
    server.use(
      http.get('http://api.test/boom', () =>
        HttpResponse.json({ error: 'server' }, { status: 500 }),
      ),
    );
    const client = createApiClient('http://api.test');
    await expect(client.get('/boom')).rejects.toMatchObject({
      response: { status: 500 },
    });
    expect(getToken()).toBe('still-valid');
  });
});
