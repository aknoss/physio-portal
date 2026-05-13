import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getRanking, getSummary } from '../api/reports';

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

export function Reports() {
  const today = useMemo(() => new Date(), []);
  const month = useMemo(() => monthRange(today), [today]);
  const week = useMemo(() => weekRange(today), [today]);

  const monthSummary = useQuery({
    queryKey: ['summary', month.from, month.to],
    queryFn: () => getSummary(month.from, month.to),
  });
  const weekSummary = useQuery({
    queryKey: ['summary', week.from, week.to],
    queryFn: () => getSummary(week.from, week.to),
  });
  const ranking = useQuery({
    queryKey: ['ranking', month.from, month.to],
    queryFn: () => getRanking(month.from, month.to),
  });

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <Link
          to="/reports/monthly"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Relatório mensal por paciente
        </Link>
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

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Ranking do mês</h2>
        {ranking.data && ranking.data.length === 0 && (
          <p className="text-sm text-slate-600">
            Nenhuma sessão realizada no período.
          </p>
        )}
        {ranking.data && ranking.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2">Paciente</th>
                <th className="py-2 text-right">Sessões</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {ranking.data.map((row) => (
                <tr key={row.patientId} className="border-t border-slate-100">
                  <td className="py-2">
                    <Link
                      to={`/patients/${row.patientId}`}
                      className="hover:underline"
                    >
                      {row.fullName}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{row.sessionCount}</td>
                  <td className="py-2 text-right font-medium">
                    {formatPrice(row.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
