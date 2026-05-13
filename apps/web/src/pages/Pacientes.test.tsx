import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import type { PatientDto } from '@physio-portal/contracts';
import { server } from '../../tests/msw/server';
import { Pacientes } from './Pacientes';

const ANA: PatientDto = {
  id: '11111111-1111-1111-1111-111111111111',
  fullName: 'Ana Souza',
  address: 'Rua A, 100',
  phone: '+5521987654321',
  sessionPriceCents: 12000,
  notes: null,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const BRUNO: PatientDto = {
  id: '22222222-2222-2222-2222-222222222222',
  fullName: 'Bruno Lima',
  address: 'Av. B, 200',
  phone: '+5521912345678',
  sessionPriceCents: 15000,
  notes: 'Joelho direito',
  active: true,
  createdAt: '2026-02-01T00:00:00.000Z',
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Pacientes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Pacientes page', () => {
  it('renders patient cards from the API', async () => {
    server.use(
      http.get('/api/patients', () => HttpResponse.json([ANA, BRUNO])),
    );
    setup();
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*120,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*150,00/)).toBeInTheDocument();
  });

  it('shows an empty state when the API returns no patients', async () => {
    server.use(http.get('/api/patients', () => HttpResponse.json([])));
    setup();
    expect(await screen.findByText(/nenhum paciente/i)).toBeInTheDocument();
  });

  it('renders a WhatsApp link with the phone digits only', async () => {
    server.use(http.get('/api/patients', () => HttpResponse.json([ANA])));
    setup();
    const link = await screen.findByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', 'https://wa.me/5521987654321');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('forwards search and active filter to the API', async () => {
    const calls: URL[] = [];
    server.use(
      http.get('/api/patients', ({ request }) => {
        calls.push(new URL(request.url));
        return HttpResponse.json([]);
      }),
    );
    setup();
    await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(1));
    await userEvent.type(screen.getByLabelText(/buscar/i), 'ana');
    await userEvent.selectOptions(screen.getByLabelText(/filtro/i), 'all');
    await waitFor(() => {
      const last = calls[calls.length - 1]!;
      expect(last.searchParams.get('search')).toBe('ana');
      expect(last.searchParams.get('active')).toBeNull();
    });
  });

  it('creates a new patient via the modal form and refreshes the list', async () => {
    let listCalls = 0;
    let createdBody: unknown = null;
    server.use(
      http.get('/api/patients', () => {
        listCalls += 1;
        if (listCalls === 1) return HttpResponse.json([]);
        return HttpResponse.json([ANA]);
      }),
      http.post('/api/patients', async ({ request }) => {
        createdBody = await request.json();
        return HttpResponse.json(ANA, { status: 201 });
      }),
    );
    setup();
    await screen.findByText(/nenhum paciente/i);
    await userEvent.click(screen.getByRole('button', { name: /novo paciente/i }));
    await userEvent.type(screen.getByLabelText(/nome completo/i), 'Ana Souza');
    await userEvent.type(screen.getByLabelText(/endereço/i), 'Rua A, 100');
    await userEvent.type(screen.getByLabelText(/telefone/i), '+5521987654321');
    await userEvent.type(screen.getByLabelText(/valor da sessão/i), '120');
    await userEvent.click(screen.getByRole('button', { name: /^salvar$/i }));
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(createdBody).toMatchObject({
      fullName: 'Ana Souza',
      sessionPriceCents: 12000,
    });
  });

  it('edits a patient via the modal form', async () => {
    let patched: unknown = null;
    let listCalls = 0;
    server.use(
      http.get('/api/patients', () => {
        listCalls += 1;
        if (listCalls === 1) return HttpResponse.json([ANA]);
        return HttpResponse.json([{ ...ANA, fullName: 'Ana Maria' }]);
      }),
      http.patch('/api/patients/:id', async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...ANA, fullName: 'Ana Maria' });
      }),
    );
    setup();
    const card = (await screen.findByText('Ana Souza')).closest('article')!;
    await userEvent.click(within(card).getByRole('button', { name: /editar/i }));
    const nameInput = screen.getByLabelText(/nome completo/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Ana Maria');
    await userEvent.click(screen.getByRole('button', { name: /^salvar$/i }));
    expect(await screen.findByText('Ana Maria')).toBeInTheDocument();
    expect(patched).toMatchObject({ fullName: 'Ana Maria', active: true });
  });

  it('deactivates a patient after confirmation', async () => {
    let listCalls = 0;
    let deletedId: string | null = null;
    server.use(
      http.get('/api/patients', () => {
        listCalls += 1;
        if (listCalls === 1) return HttpResponse.json([ANA]);
        return HttpResponse.json([]);
      }),
      http.delete('/api/patients/:id', ({ params }) => {
        deletedId = params.id as string;
        return HttpResponse.json({ ...ANA, active: false });
      }),
    );
    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockImplementation(() => true);
    setup();
    const card = (await screen.findByText('Ana Souza')).closest('article')!;
    await userEvent.click(within(card).getByRole('button', { name: /desativar/i }));
    await waitFor(() => expect(deletedId).toBe(ANA.id));
    await screen.findByText(/nenhum paciente/i);
    confirmSpy.mockRestore();
  });

  it('does not delete when the user cancels the confirmation', async () => {
    let deleteCount = 0;
    server.use(
      http.get('/api/patients', () => HttpResponse.json([ANA])),
      http.delete('/api/patients/:id', () => {
        deleteCount += 1;
        return HttpResponse.json({ ...ANA, active: false });
      }),
    );
    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockImplementation(() => false);
    setup();
    const card = (await screen.findByText('Ana Souza')).closest('article')!;
    await userEvent.click(within(card).getByRole('button', { name: /desativar/i }));
    expect(deleteCount).toBe(0);
    confirmSpy.mockRestore();
  });
});
