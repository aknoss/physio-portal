import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { listPatients } from '../api/patients';
import {
  downloadMonthlyReportPdf,
  getPatientSummary,
} from '../api/reports';

const priceFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100);
}

function defaultMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthBounds(month: string): { from: string; to: string } {
  const [yStr, mStr] = month.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function MonthlyReport() {
  const [patientId, setPatientId] = useState('');
  const [month, setMonth] = useState(() => defaultMonth(new Date()));

  const patients = useQuery({
    queryKey: ['patients', { active: true }],
    queryFn: () => listPatients({ active: true }),
  });

  const bounds = useMemo(() => monthBounds(month), [month]);
  const preview = useQuery({
    queryKey: ['report-preview', patientId, bounds.from, bounds.to],
    queryFn: () => getPatientSummary(patientId, bounds.from, bounds.to),
    enabled: Boolean(patientId),
  });

  const download = useMutation({
    mutationFn: async () => {
      const blob = await downloadMonthlyReportPdf(patientId, month);
      triggerDownload(blob, `relatorio-${patientId}-${month}.pdf`);
    },
  });

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <Link to="/reports" className="text-sm text-slate-600 hover:underline">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-semibold">Relatório mensal</h1>
      </header>

      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="patient" className="block text-sm font-medium">
            Paciente
          </label>
          <select
            id="patient"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— Selecione —</option>
            {patients.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="month" className="block text-sm font-medium">
            Mês
          </label>
          <input
            id="month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {patientId && preview.data && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase text-slate-500">Prévia</p>
          <p className="text-2xl font-semibold">
            {formatPrice(preview.data.totalCents)}
          </p>
          <p className="text-sm text-slate-600">
            {preview.data.sessionCount} sessões realizadas
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => download.mutate()}
        disabled={!patientId || download.isPending}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Download PDF
      </button>

      {download.isError && (
        <p role="alert" className="text-sm text-red-600">
          Erro ao gerar o PDF.
        </p>
      )}
    </section>
  );
}
