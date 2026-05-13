import { describe, it, expect } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { AuthProvider, useAuth } from './AuthContext';
import { getToken, setToken } from '../api/client';

function Harness() {
  const { user, status, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user ? user.fullName : 'anonymous'}</p>
      <button
        onClick={() => {
          void login({ email: 'pt@example.com', password: 'secret' });
        }}
      >
        sign in
      </button>
      <button onClick={() => logout()}>sign out</button>
    </div>
  );
}

const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'pt@example.com',
  fullName: 'Dra. Ana',
  cref: 'CREFITO 12345',
  signatureUrl: null,
};

describe('AuthProvider', () => {
  it('starts unauthenticated when no token is stored', async () => {
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    );
    expect(screen.getByTestId('user')).toHaveTextContent('anonymous');
  });

  it('hydrates the session from a stored token', async () => {
    setToken('stored');
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(USER)),
    );
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );
    expect(screen.getByTestId('user')).toHaveTextContent('Dra. Ana');
  });

  it('clears state if the stored token is rejected', async () => {
    setToken('expired');
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    );
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    );
    expect(getToken()).toBeNull();
  });

  it('logs in and stores the token', async () => {
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        const body = (await request.json()) as { email: string; password: string };
        expect(body.email).toBe('pt@example.com');
        return HttpResponse.json({ token: 'new-token', user: USER });
      }),
    );
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    );
    await userEvent.click(screen.getByText('sign in'));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );
    expect(screen.getByTestId('user')).toHaveTextContent('Dra. Ana');
    expect(getToken()).toBe('new-token');
  });

  it('logs out and clears the stored token', async () => {
    setToken('tok');
    server.use(http.get('/api/auth/me', () => HttpResponse.json(USER)));
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );
    await act(async () => {
      await userEvent.click(screen.getByText('sign out'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    );
    expect(getToken()).toBeNull();
  });

  it('throws when useAuth is called outside AuthProvider', () => {
    const Bad = () => {
      useAuth();
      return null;
    };
    expect(() => render(<Bad />)).toThrow(/AuthProvider/);
  });
});
