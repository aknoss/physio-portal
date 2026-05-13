import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { AuthProvider } from './AuthContext';
import { RequireAuth } from './RequireAuth';
import { setToken } from '../api/client';

const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'pt@example.com',
  fullName: 'Dra. Ana',
  cref: 'CREFITO 12345',
  signatureUrl: null,
};

function renderWithRouter(initial = '/dashboard') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <p>protected content</p>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('RequireAuth', () => {
  it('renders the children when authenticated', async () => {
    setToken('tok');
    server.use(http.get('/api/auth/me', () => HttpResponse.json(USER)));
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByText('protected content')).toBeInTheDocument(),
    );
  });

  it('redirects to /login when not authenticated', async () => {
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByText('login page')).toBeInTheDocument(),
    );
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('shows a loading placeholder while hydrating', async () => {
    setToken('tok');
    server.use(
      http.get('/api/auth/me', async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return HttpResponse.json(USER);
      }),
    );
    renderWithRouter();
    expect(screen.getByRole('status')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('protected content')).toBeInTheDocument(),
    );
  });
});
