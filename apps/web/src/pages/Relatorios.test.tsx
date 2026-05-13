import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { Relatorios } from './Relatorios';

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Relatorios />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-03-11T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Relatorios dashboard', () => {
  it('renders weekly and monthly totals using current ranges', async () => {
    server.use(
      http.get('/api/reports/summary', ({ request }) => {
        const url = new URL(request.url);
        const from = url.searchParams.get('from') ?? '';
        if (from === '2026-03-01') {
          return HttpResponse.json({
            from,
            to: '2026-03-31',
            totalCents: 90000,
            sessionCount: 8,
          });
        }
        return HttpResponse.json({
          from,
          to: '2026-03-15',
          totalCents: 36000,
          sessionCount: 3,
        });
      }),
      http.get('/api/reports/ranking', () => HttpResponse.json([])),
    );
    setup();
    await waitFor(() =>
      expect(screen.getByTestId('summary-month')).toHaveTextContent(/R\$\s*900,00/),
    );
    expect(screen.getByTestId('summary-week')).toHaveTextContent(/R\$\s*360,00/);
  });

  it('renders the patient ranking list', async () => {
    server.use(
      http.get('/api/reports/summary', () =>
        HttpResponse.json({ from: '', to: '', totalCents: 0, sessionCount: 0 }),
      ),
      http.get('/api/reports/ranking', () =>
        HttpResponse.json([
          {
            patientId: '11111111-1111-1111-1111-111111111111',
            fullName: 'Ana',
            totalCents: 60000,
            sessionCount: 5,
          },
          {
            patientId: '22222222-2222-2222-2222-222222222222',
            fullName: 'Bruno',
            totalCents: 24000,
            sessionCount: 2,
          },
        ]),
      ),
    );
    setup();
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*600,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*240,00/)).toBeInTheDocument();
  });

  it('shows an empty state when the ranking is empty', async () => {
    server.use(
      http.get('/api/reports/summary', () =>
        HttpResponse.json({ from: '', to: '', totalCents: 0, sessionCount: 0 }),
      ),
      http.get('/api/reports/ranking', () => HttpResponse.json([])),
    );
    setup();
    expect(
      await screen.findByText(/nenhuma sessão realizada/i),
    ).toBeInTheDocument();
  });

  it('links to the monthly PDF page', async () => {
    server.use(
      http.get('/api/reports/summary', () =>
        HttpResponse.json({ from: '', to: '', totalCents: 0, sessionCount: 0 }),
      ),
      http.get('/api/reports/ranking', () => HttpResponse.json([])),
    );
    setup();
    const link = await screen.findByRole('link', { name: /relatório mensal/i });
    expect(link).toHaveAttribute('href', '/relatorios/mensal');
  });
});
