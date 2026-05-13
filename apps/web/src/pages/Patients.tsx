import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PatientDto } from '@physio-portal/contracts';
import {
  createPatient,
  deactivatePatient,
  listPatients,
  updatePatient,
} from '../api/patients';
import { PatientForm, type PatientFormValues } from '../components/PatientForm';

type ActiveFilter = 'all' | 'active' | 'inactive';

const priceFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100);
}

function whatsappHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

export function Patients() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PatientDto | null>(null);

  const filter = useMemo(() => {
    const f: { active?: boolean; search?: string } = {};
    if (activeFilter !== 'all') f.active = activeFilter === 'active';
    if (search.trim()) f.search = search.trim();
    return f;
  }, [activeFilter, search]);

  const patientsQuery = useQuery({
    queryKey: ['patients', filter],
    queryFn: () => listPatients(filter),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['patients'] });

  const createMutation = useMutation({
    mutationFn: (values: PatientFormValues) =>
      createPatient({
        fullName: values.fullName,
        address: values.address,
        phone: values.phone,
        sessionPriceCents: values.sessionPriceCents,
        notes: values.notes,
      }),
    onSuccess: () => {
      setCreating(false);
      void invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: PatientFormValues }) =>
      updatePatient(id, {
        fullName: values.fullName,
        address: values.address,
        phone: values.phone,
        sessionPriceCents: values.sessionPriceCents,
        notes: values.notes,
        active: values.active ?? true,
      }),
    onSuccess: () => {
      setEditing(null);
      void invalidate();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivatePatient(id),
    onSuccess: () => void invalidate(),
  });

  const handleDeactivate = (p: PatientDto) => {
    if (!window.confirm(`Desativar paciente ${p.fullName}?`)) return;
    deactivateMutation.mutate(p.id);
  };

  const patients = patientsQuery.data ?? [];

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pacientes</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Novo paciente
        </button>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[12rem]">
          <label htmlFor="patients-search" className="block text-sm font-medium">
            Buscar
          </label>
          <input
            id="patients-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            placeholder="Nome do paciente"
          />
        </div>
        <div>
          <label htmlFor="patients-filter" className="block text-sm font-medium">
            Filtro
          </label>
          <select
            id="patients-filter"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
            className="mt-1 rounded border border-slate-300 px-3 py-2"
          >
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="all">Todos</option>
          </select>
        </div>
      </div>

      {patientsQuery.isLoading && <p className="text-sm text-slate-600">Carregando…</p>}
      {patientsQuery.isError && (
        <p role="alert" className="text-sm text-red-600">
          Erro ao carregar pacientes.
        </p>
      )}
      {patientsQuery.isSuccess && patients.length === 0 && (
        <p className="text-sm text-slate-600">Nenhum paciente encontrado.</p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {patients.map((p) => (
          <li key={p.id}>
            <article className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    <Link to={`/patients/${p.id}`} className="hover:underline">
                      {p.fullName}
                    </Link>
                  </h2>
                  <p className="text-sm text-slate-600">{p.address}</p>
                </div>
                {!p.active && (
                  <span className="rounded bg-slate-200 px-2 py-1 text-xs">
                    Inativo
                  </span>
                )}
              </div>
              <p className="text-sm">
                <span className="text-slate-500">Telefone:</span> {p.phone}
              </p>
              <p className="text-sm font-medium">{formatPrice(p.sessionPriceCents)}</p>
              {p.notes && <p className="text-sm text-slate-600">{p.notes}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={whatsappHref(p.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white"
                >
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
                >
                  Editar
                </button>
                {p.active && (
                  <button
                    type="button"
                    onClick={() => handleDeactivate(p)}
                    className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                  >
                    Desativar
                  </button>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>

      {(creating || editing) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editing ? 'Editar paciente' : 'Novo paciente'}
            </h2>
            <PatientForm
              {...(editing ? { initial: editing } : {})}
              onSubmit={async (values) => {
                if (editing) {
                  await updateMutation.mutateAsync({ id: editing.id, values });
                } else {
                  await createMutation.mutateAsync(values);
                }
              }}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
