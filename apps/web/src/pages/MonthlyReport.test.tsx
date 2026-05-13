import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { PatientDto } from '@physio-portal/contracts';
import { server } from '../../tests/msw/server';
import { MonthlyReport } from './MonthlyReport';

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

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MonthlyReport />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MonthlyReport page', () => {
  it('renders the patient selector populated from the API', async () => {
    server.use(http.get('/api/patients', () => HttpResponse.json([ANA])));
    setup();
    const select = (await screen.findByLabelText(/paciente/i)) as HTMLSelectElement;
    await waitFor(() =>
      expect(within(select).getByRole('option', { name: 'Ana Souza' })).toBeDefined(),
    );
  });

  it('defaults the month to the current YYYY-MM', async () => {
    server.use(http.get('/api/patients', () => HttpResponse.json([ANA])));
    setup();
    const monthInput = (await screen.findByLabelText(/mês/i)) as HTMLInputElement;
    expect(monthInput.value).toBe('2026-03');
  });

  it('shows the preview totals when a patient and month are selected', async () => {
    server.use(
      http.get('/api/patients', () => HttpResponse.json([ANA])),
      http.get('/api/reports/patient/:id', ({ request, params }) => {
        const url = new URL(request.url);
        expect(params.id).toBe(ANA.id);
        expect(url.searchParams.get('from')).toBe('2026-03-01');
        expect(url.searchParams.get('to')).toBe('2026-03-31');
        return HttpResponse.json({
          patientId: ANA.id,
          from: '2026-03-01',
          to: '2026-03-31',
          totalCents: 48000,
          sessionCount: 4,
        });
      }),
    );
    setup();
    const select = (await screen.findByLabelText(/paciente/i)) as HTMLSelectElement;
    await userEvent.selectOptions(select, ANA.id);
    expect(await screen.findByText(/R\$\s*480,00/)).toBeInTheDocument();
    expect(screen.getByText(/4 sessões/i)).toBeInTheDocument();
  });

  it('downloads the PDF when the download button is clicked', async () => {
    let pdfRequested = false;
    server.use(
      http.get('/api/patients', () => HttpResponse.json([ANA])),
      http.get('/api/reports/patient/:id', () =>
        HttpResponse.json({
          patientId: ANA.id,
          from: '2026-03-01',
          to: '2026-03-31',
          totalCents: 0,
          sessionCount: 0,
        }),
      ),
      http.get('/api/reports/patient/:id/monthly.pdf', ({ params, request }) => {
        const url = new URL(request.url);
        expect(params.id).toBe(ANA.id);
        expect(url.searchParams.get('month')).toBe('2026-03');
        pdfRequested = true;
        return HttpResponse.arrayBuffer(new TextEncoder().encode('PDF').buffer, {
          headers: { 'Content-Type': 'application/pdf' },
        });
      }),
    );
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    setup();
    const select = (await screen.findByLabelText(/paciente/i)) as HTMLSelectElement;
    await userEvent.selectOptions(select, ANA.id);
    await userEvent.click(screen.getByRole('button', { name: /download pdf/i }));
    await waitFor(() => expect(pdfRequested).toBe(true));
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('disables the download button when no patient is selected', async () => {
    server.use(http.get('/api/patients', () => HttpResponse.json([ANA])));
    setup();
    await screen.findByLabelText(/paciente/i);
    const btn = screen.getByRole('button', { name: /download pdf/i });
    expect(btn).toBeDisabled();
  });
});

