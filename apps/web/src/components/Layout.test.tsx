import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { AuthProvider } from '../auth/AuthContext';
import { RequireAuth } from '../auth/RequireAuth';
import { Layout } from './Layout';

const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'pt@example.com',
  fullName: 'Dra. Ana',
  cref: 'CREFITO 12345',
  signatureUrl: null,
};

function setup(initial = '/') {
  window.localStorage.setItem('physio.token', 'tok');
  server.use(http.get('/api/auth/me', () => HttpResponse.json(USER)));
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<p>conteúdo</p>} />
            <Route path="pacientes" element={<p>página de pacientes</p>} />
            <Route path="relatorios" element={<p>página de relatórios</p>} />
            <Route
              path="configuracoes"
              element={<p>página de configurações</p>}
            />
          </Route>
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('Layout', () => {
  it('shows the PT-BR navigation links and the signed-in user name', async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByText('Dra. Ana')).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: /pacientes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /relatórios/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /configurações/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('navigates between sections via the sidebar', async () => {
    setup();
    await waitFor(() => screen.getByText('Dra. Ana'));
    await userEvent.click(screen.getByRole('link', { name: /pacientes/i }));
    expect(
      await screen.findByText('página de pacientes'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /relatórios/i }));
    expect(
      await screen.findByText('página de relatórios'),
    ).toBeInTheDocument();
  });

  it('logs out when the Sair button is clicked', async () => {
    setup();
    await waitFor(() => screen.getByText('Dra. Ana'));
    await userEvent.click(screen.getByRole('button', { name: /sair/i }));
    await waitFor(() =>
      expect(screen.getByText('login page')).toBeInTheDocument(),
    );
    expect(window.localStorage.getItem('physio.token')).toBeNull();
  });
});
