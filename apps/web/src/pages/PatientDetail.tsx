import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SessionDto,
  UpdatableSessionStatus,
} from '@physio-portal/contracts';
import { getPatient } from '../api/patients';
import { getSchedule, upsertSchedule } from '../api/schedules';
import { generateSessions, listSessions, updateSession } from '../api/sessions';
import { getPatientSummary } from '../api/reports';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_STYLES: Record<SessionDto['status'], string> = {
  SCHEDULED: 'bg-slate-200 text-slate-800',
  REALIZADA: 'bg-emerald-200 text-emerald-900',
  FALTA: 'bg-red-200 text-red-900',
  REMARCADA: 'bg-amber-200 text-amber-900',
};

const priceFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100);
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthRange(d: Date): { from: string; to: string } {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toYmd(first), to: toYmd(last) };
}

function weekRange(d: Date): { from: string; to: string } {
  const day = d.getDay();
  const offsetFromMon = (day + 6) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offsetFromMon);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { from: toYmd(start), to: toYmd(end) };
}

function daysOfMonth(d: Date): Date[] {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Array.from(
    { length: last },
    (_, i) => new Date(d.getFullYear(), d.getMonth(), i + 1),
  );
}

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const patientId = id!;
  const qc = useQueryClient();
  const [currentMonth] = useState(() => new Date());

  const month = useMemo(() => monthRange(currentMonth), [currentMonth]);
  const week = useMemo(() => weekRange(currentMonth), [currentMonth]);

  const patientQuery = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatient(patientId),
  });
  const scheduleQuery = useQuery({
    queryKey: ['schedule', patientId],
    queryFn: () => getSchedule(patientId),
  });
  const sessionsQuery = useQuery({
    queryKey: ['sessions', patientId, month.from, month.to],
    queryFn: () => listSessions(patientId, month.from, month.to),
  });
  const monthSummary = useQuery({
    queryKey: ['summary', patientId, month.from, month.to],
    queryFn: () => getPatientSummary(patientId, month.from, month.to),
  });
  const weekSummary = useQuery({
    queryKey: ['summary', patientId, week.from, week.to],
    queryFn: () => getPatientSummary(patientId, week.from, week.to),
  });

  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSession, setSelectedSession] = useState<SessionDto | null>(null);

  useEffect(() => {
    const data = scheduleQuery.data;
    if (data) {
      setWeekdays([...data.weekdays].sort((a, b) => a - b));
      setStartDate(data.startDate);
      setEndDate(data.endDate ?? '');
    } else if (data === null) {
      setWeekdays([]);
      setStartDate(toYmd(new Date()));
      setEndDate('');
    }
  }, [scheduleQuery.data]);

  const saveSchedule = useMutation({
    mutationFn: () => {
      const body: { weekdays: number[]; startDate: string; endDate?: string | null } = {
        weekdays: [...weekdays].sort((a, b) => a - b),
        startDate,
      };
      if (endDate) body.endDate = endDate;
      return upsertSchedule(patientId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['schedule', patientId] });
    },
  });

  const generate = useMutation({
    mutationFn: () => generateSessions(patientId, month.from, month.to),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sessions', patientId] });
      void qc.invalidateQueries({ queryKey: ['summary', patientId] });
    },
  });

  const setStatus = useMutation({
    mutationFn: ({ id: sid, status }: { id: string; status: UpdatableSessionStatus }) =>
      updateSession(sid, { status }),
    onSuccess: () => {
      setSelectedSession(null);
      void qc.invalidateQueries({ queryKey: ['sessions', patientId] });
      void qc.invalidateQueries({ queryKey: ['summary', patientId] });
    },
  });

  const toggleWeekday = (w: number) => {
    setWeekdays((curr) =>
      curr.includes(w) ? curr.filter((x) => x !== w) : [...curr, w],
    );
  };

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionDto>();
    for (const s of sessionsQuery.data ?? []) map.set(s.date, s);
    return map;
  }, [sessionsQuery.data]);

  const patient = patientQuery.data;
  const days = daysOfMonth(currentMonth);
  const leadingBlanks = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1,
  ).getDay();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link to="/pacientes" className="text-sm text-slate-600 hover:underline">
          ← Voltar
        </Link>
        {patient && (
          <>
            <h1 className="text-2xl font-semibold">{patient.fullName}</h1>
            <p className="text-sm text-slate-600">
              {patient.address} · {patient.phone}
            </p>
            <p className="text-sm font-medium">
              {formatPrice(patient.sessionPriceCents)} / sessão
            </p>
          </>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div
          data-testid="summary-week"
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <p className="text-xs uppercase text-slate-500">Semana</p>
          <p className="text-xl font-semibold">
            {weekSummary.data ? formatPrice(weekSummary.data.totalCents) : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {weekSummary.data?.sessionCount ?? 0} sessões realizadas
          </p>
        </div>
        <div
          data-testid="summary-month"
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <p className="text-xs uppercase text-slate-500">Mês</p>
          <p className="text-xl font-semibold">
            {monthSummary.data ? formatPrice(monthSummary.data.totalCents) : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {monthSummary.data?.sessionCount ?? 0} sessões realizadas
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold">Agendamento recorrente</h2>
        {scheduleQuery.data === null && (
          <p className="text-sm text-amber-700">Sem agendamento cadastrado.</p>
        )}
        <div className="flex flex-wrap gap-3">
          {WEEKDAY_LABELS.map((label, i) => (
            <label key={i} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={weekdays.includes(i)}
                onChange={() => toggleWeekday(i)}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="startDate" className="block text-xs text-slate-600">
              Início
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-xs text-slate-600">
              Término (opcional)
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => saveSchedule.mutate()}
            disabled={
              saveSchedule.isPending || weekdays.length === 0 || !startDate
            }
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Salvar agendamento
          </button>
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={generate.isPending || !scheduleQuery.data}
            className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60"
          >
            Gerar sessões deste mês
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">
          Calendário —{' '}
          {currentMonth.toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
          })}
        </h2>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
          {WEEKDAY_LABELS.map((l) => (
            <div key={l} className="py-1 font-medium">
              {l}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {days.map((d) => {
            const ymd = toYmd(d);
            const session = sessionsByDate.get(ymd);
            if (!session) {
              return (
                <div
                  key={ymd}
                  className="rounded border border-slate-100 p-2 text-slate-400"
                >
                  {d.getDate()}
                </div>
              );
            }
            return (
              <button
                key={ymd}
                type="button"
                data-testid={`session-cell-${ymd}`}
                data-status={session.status}
                onClick={() => setSelectedSession(session)}
                className={`rounded p-2 text-sm font-medium ${STATUS_STYLES[session.status]}`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </section>

      {selectedSession && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">
              Sessão de {selectedSession.date}
            </h2>
            <p className="text-sm text-slate-600">
              Status atual: <strong>{selectedSession.status}</strong>
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() =>
                  setStatus.mutate({ id: selectedSession.id, status: 'REALIZADA' })
                }
                className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
              >
                Realizada
              </button>
              <button
                type="button"
                onClick={() =>
                  setStatus.mutate({ id: selectedSession.id, status: 'FALTA' })
                }
                className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white"
              >
                Falta
              </button>
              <button
                type="button"
                onClick={() =>
                  setStatus.mutate({ id: selectedSession.id, status: 'REMARCADA' })
                }
                className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white"
              >
                Remarcada
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
