import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type {
  PatientDto,
  ScheduleDto,
  SessionDto,
} from '@physio-portal/contracts';
import { server } from '../../tests/msw/server';
import { PatientDetail } from './PatientDetail';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

const PATIENT: PatientDto = {
  id: PATIENT_ID,
  fullName: 'Ana Souza',
  address: 'Rua A, 100',
  phone: '+5521987654321',
  sessionPriceCents: 12000,
  notes: null,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const SCHEDULE: ScheduleDto = {
  patientId: PATIENT_ID,
  weekdays: [1, 3],
  startDate: '2026-01-01',
  endDate: null,
};

function makeSession(date: string, status: SessionDto['status'], id = date): SessionDto {
  return {
    id: `session-${id}`,
    patientId: PATIENT_ID,
    date,
    status,
    priceCents: 12000,
    note: null,
  };
}

function defaultHandlers(opts: {
  patient?: PatientDto;
  schedule?: ScheduleDto | null;
  sessions?: SessionDto[];
  monthly?: { totalCents: number; sessionCount: number };
  weekly?: { totalCents: number; sessionCount: number };
} = {}) {
  const patient = opts.patient ?? PATIENT;
  const schedule = opts.schedule === undefined ? SCHEDULE : opts.schedule;
  const sessions = opts.sessions ?? [];
  const monthly = opts.monthly ?? { totalCents: 0, sessionCount: 0 };
  const weekly = opts.weekly ?? { totalCents: 0, sessionCount: 0 };
  return [
    http.get(`/api/patients/${PATIENT_ID}`, () => HttpResponse.json(patient)),
    http.get(`/api/patients/${PATIENT_ID}/schedule`, () => {
      if (schedule === null) {
        return HttpResponse.json({ error: 'not found' }, { status: 404 });
      }
      return HttpResponse.json(schedule);
    }),
    http.get(`/api/patients/${PATIENT_ID}/sessions`, () =>
      HttpResponse.json(sessions),
    ),
    http.get(`/api/reports/patient/${PATIENT_ID}`, ({ request }) => {
      const url = new URL(request.url);
      const from = url.searchParams.get('from') ?? '';
      const isWeekly = from.endsWith('-09') || from.endsWith('-16');
      const totals = isWeekly ? weekly : monthly;
      return HttpResponse.json({
        patientId: PATIENT_ID,
        from,
        to: url.searchParams.get('to') ?? '',
        totalCents: totals.totalCents,
        sessionCount: totals.sessionCount,
      });
    }),
  ];
}

function setup(initial = `/pacientes/${PATIENT_ID}`) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/pacientes/:id" element={<PatientDetail />} />
          <Route path="/pacientes" element={<p>lista</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // Wednesday, 2026-03-11. March 2026 starts on a Sunday.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-03-11T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PatientDetail page', () => {
  it('renders the patient information', async () => {
    server.use(...defaultHandlers());
    setup();
    expect(await screen.findByRole('heading', { name: 'Ana Souza' })).toBeInTheDocument();
    expect(screen.getByText(/\+5521987654321/)).toBeInTheDocument();
    expect(screen.getByText(/Rua A, 100/)).toBeInTheDocument();
  });

  it('renders weekly and monthly totals from the report API', async () => {
    server.use(
      ...defaultHandlers({
        monthly: { totalCents: 60000, sessionCount: 5 },
        weekly: { totalCents: 24000, sessionCount: 2 },
      }),
    );
    setup();
    const semana = await screen.findByTestId('summary-week');
    const mes = screen.getByTestId('summary-month');
    await waitFor(() => {
      expect(semana).toHaveTextContent(/R\$\s*240,00/);
      expect(mes).toHaveTextContent(/R\$\s*600,00/);
    });
  });

  it('renders the schedule editor with the existing weekdays selected', async () => {
    server.use(...defaultHandlers());
    setup();
    const monday = (await screen.findByLabelText(/seg/i)) as HTMLInputElement;
    const wednesday = screen.getByLabelText(/qua/i) as HTMLInputElement;
    const tuesday = screen.getByLabelText(/^ter/i) as HTMLInputElement;
    await waitFor(() => expect(monday.checked).toBe(true));
    expect(wednesday.checked).toBe(true);
    expect(tuesday.checked).toBe(false);
  });

  it('saves the schedule when the user clicks save', async () => {
    let putBody: unknown = null;
    server.use(
      ...defaultHandlers(),
      http.put(`/api/patients/${PATIENT_ID}/schedule`, async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ ...SCHEDULE, weekdays: [1, 3, 5] });
      }),
    );
    setup();
    await screen.findByLabelText(/seg/i);
    await userEvent.click(screen.getByLabelText(/sex/i));
    await userEvent.click(screen.getByRole('button', { name: /salvar agendamento/i }));
    await waitFor(() =>
      expect(putBody).toMatchObject({
        weekdays: [1, 3, 5],
        startDate: '2026-01-01',
      }),
    );
  });

  it('prompts to create a schedule when none exists yet', async () => {
    server.use(...defaultHandlers({ schedule: null }));
    setup();
    expect(
      await screen.findByText(/sem agendamento cadastrado/i),
    ).toBeInTheDocument();
    const monday = screen.getByLabelText(/seg/i) as HTMLInputElement;
    expect(monday.checked).toBe(false);
  });

  it('renders the calendar with status-colored cells for the current month', async () => {
    const sessions = [
      makeSession('2026-03-02', 'REALIZADA'),
      makeSession('2026-03-04', 'FALTA'),
      makeSession('2026-03-09', 'SCHEDULED'),
      makeSession('2026-03-11', 'REMARCADA'),
    ];
    server.use(...defaultHandlers({ sessions }));
    setup();
    await screen.findByTestId('session-cell-2026-03-02');
    expect(screen.getByTestId('session-cell-2026-03-02')).toHaveAttribute(
      'data-status',
      'REALIZADA',
    );
    expect(screen.getByTestId('session-cell-2026-03-04')).toHaveAttribute(
      'data-status',
      'FALTA',
    );
    expect(screen.getByTestId('session-cell-2026-03-09')).toHaveAttribute(
      'data-status',
      'SCHEDULED',
    );
    expect(screen.getByTestId('session-cell-2026-03-11')).toHaveAttribute(
      'data-status',
      'REMARCADA',
    );
  });

  it('opens the modal when a session cell is clicked and PATCHes the new status', async () => {
    let patched: unknown = null;
    const sessions = [makeSession('2026-03-09', 'SCHEDULED')];
    server.use(
      ...defaultHandlers({ sessions }),
      http.patch('/api/sessions/:id', async ({ request, params }) => {
        patched = await request.json();
        expect(params.id).toBe('session-2026-03-09');
        return HttpResponse.json({
          ...sessions[0]!,
          status: 'REALIZADA',
        });
      }),
    );
    setup();
    const cell = await screen.findByTestId('session-cell-2026-03-09');
    await userEvent.click(cell);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /realizada/i }));
    await waitFor(() => expect(patched).toEqual({ status: 'REALIZADA' }));
  });

  it('generates this month’s sessions when the button is clicked', async () => {
    let generated: unknown = null;
    server.use(
      ...defaultHandlers(),
      http.post(`/api/patients/${PATIENT_ID}/sessions/generate`, async ({ request }) => {
        generated = await request.json();
        return HttpResponse.json([], { status: 201 });
      }),
    );
    setup();
    await screen.findByLabelText(/seg/i);
    await userEvent.click(screen.getByRole('button', { name: /gerar sessões/i }));
    await waitFor(() =>
      expect(generated).toEqual({ from: '2026-03-01', to: '2026-03-31' }),
    );
  });
});
