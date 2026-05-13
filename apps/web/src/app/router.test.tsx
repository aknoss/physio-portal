import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { AuthProvider } from '../auth/AuthContext';
import { AppRouter } from './router';

const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'pt@example.com',
  fullName: 'Dra. Ana',
  cref: 'CREFITO 12345',
  signatureUrl: null,
};

function renderAt(initial: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initial]}>
        <AppRouter />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('AppRouter', () => {
  it('redirects an unauthenticated user from / to /login', async () => {
    renderAt('/');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument(),
    );
  });

  it('routes / to /pacientes when authenticated', async () => {
    window.localStorage.setItem('physio.token', 'tok');
    server.use(http.get('/api/auth/me', () => HttpResponse.json(USER)));
    renderAt('/');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /pacientes/i }),
      ).toBeInTheDocument(),
    );
  });

  it('renders the Relatórios page', async () => {
    window.localStorage.setItem('physio.token', 'tok');
    server.use(http.get('/api/auth/me', () => HttpResponse.json(USER)));
    renderAt('/relatorios');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /relatórios/i }),
      ).toBeInTheDocument(),
    );
  });

  it('renders the Configurações page', async () => {
    window.localStorage.setItem('physio.token', 'tok');
    server.use(http.get('/api/auth/me', () => HttpResponse.json(USER)));
    renderAt('/configuracoes');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /configurações/i }),
      ).toBeInTheDocument(),
    );
  });

  it('redirects an unknown path back to /', async () => {
    window.localStorage.setItem('physio.token', 'tok');
    server.use(http.get('/api/auth/me', () => HttpResponse.json(USER)));
    renderAt('/nao-existe');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /pacientes/i }),
      ).toBeInTheDocument(),
    );
  });
});
