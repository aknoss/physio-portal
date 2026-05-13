import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { AuthProvider } from '../auth/AuthContext';
import { Settings } from './Settings';

const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'pt@example.com',
  fullName: 'Dra. Ana',
  cref: 'CREFITO-123',
  signatureUrl: null as string | null,
};

function setup() {
  window.localStorage.setItem('physio.token', 'tok');
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Settings page', () => {
  it('pre-fills the form with the current physiotherapist profile', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(USER)));
    setup();
    const fullName = (await screen.findByLabelText(/nome completo/i)) as HTMLInputElement;
    await waitFor(() => expect(fullName.value).toBe('Dra. Ana'));
    expect((screen.getByLabelText(/cref/i) as HTMLInputElement).value).toBe(
      'CREFITO-123',
    );
  });

  it('PATCHes /auth/me with the new name and CREF on save', async () => {
    let patched: unknown = null;
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(USER)),
      http.patch('/api/auth/me', async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({
          ...USER,
          fullName: 'Dra. Maria',
          cref: 'CREFITO-999',
        });
      }),
    );
    setup();
    const fullName = (await screen.findByLabelText(/nome completo/i)) as HTMLInputElement;
    await waitFor(() => expect(fullName.value).toBe('Dra. Ana'));
    await userEvent.clear(fullName);
    await userEvent.type(fullName, 'Dra. Maria');
    const cref = screen.getByLabelText(/cref/i);
    await userEvent.clear(cref);
    await userEvent.type(cref, 'CREFITO-999');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() =>
      expect(patched).toEqual({ fullName: 'Dra. Maria', cref: 'CREFITO-999' }),
    );
    expect(
      await screen.findByText(/perfil atualizado/i),
    ).toBeInTheDocument();
  });

  it('uploads a signature PNG to /auth/me/signature', async () => {
    let uploaded = false;
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(USER)),
      http.post('/api/auth/me/signature', () => {
        uploaded = true;
        return HttpResponse.json({ ...USER, signatureUrl: '/uploads/sig.png' });
      }),
    );
    setup();
    await screen.findByLabelText(/nome completo/i);
    const file = new File([new Uint8Array([1, 2, 3])], 'sig.png', {
      type: 'image/png',
    });
    const input = screen.getByLabelText(/assinatura/i) as HTMLInputElement;
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole('button', { name: /enviar assinatura/i }));
    await waitFor(() => expect(uploaded).toBe(true));
    expect(await screen.findByText(/assinatura enviada/i)).toBeInTheDocument();
  });

  it('disables the upload button when no file is selected', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(USER)));
    setup();
    await screen.findByLabelText(/nome completo/i);
    expect(
      screen.getByRole('button', { name: /enviar assinatura/i }),
    ).toBeDisabled();
  });

  it('shows current signature when the profile has one', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ ...USER, signatureUrl: '/uploads/sig.png' }),
      ),
    );
    setup();
    const img = (await screen.findByAltText(/assinatura atual/i)) as HTMLImageElement;
    expect(img.src).toContain('/uploads/sig.png');
  });
});
