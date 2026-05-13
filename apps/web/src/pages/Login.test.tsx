import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { AuthProvider } from '../auth/AuthContext';
import { Login } from './Login';

const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'pt@example.com',
  fullName: 'Dra. Ana',
  cref: 'CREFITO 12345',
  signatureUrl: null,
};

function setup(initial = '/login') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<p>home page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('Login page', () => {
  it('renders PT-BR labels', async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('shows client-side validation errors', async () => {
    setup();
    await waitFor(() => screen.getByRole('button', { name: /entrar/i }));
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText(/informe um e-mail/i)).toBeInTheDocument();
    expect(await screen.findByText(/informe a senha/i)).toBeInTheDocument();
  });

  it('navigates home after a successful login', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ token: 'tok', user: USER }),
      ),
    );
    setup();
    await waitFor(() => screen.getByRole('button', { name: /entrar/i }));
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'pt@example.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() =>
      expect(screen.getByText('home page')).toBeInTheDocument(),
    );
  });

  it('shows a server error when credentials are rejected', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ error: 'invalid' }, { status: 401 }),
      ),
    );
    setup();
    await waitFor(() => screen.getByRole('button', { name: /entrar/i }));
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'pt@example.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(
      await screen.findByText(/credenciais inválidas/i),
    ).toBeInTheDocument();
  });

  it('redirects an already-authenticated user away from /login', async () => {
    window.localStorage.setItem('physio.token', 'tok');
    server.use(http.get('/api/auth/me', () => HttpResponse.json(USER)));
    setup();
    await waitFor(() =>
      expect(screen.getByText('home page')).toBeInTheDocument(),
    );
  });
});
