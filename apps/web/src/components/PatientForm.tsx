import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PatientDto } from '@physio-portal/contracts';

const FormSchema = z.object({
  fullName: z.string().trim().min(1, 'Informe o nome'),
  address: z.string().trim().min(1, 'Informe o endereço'),
  phone: z
    .string()
    .trim()
    .regex(/^\+55\d{10,11}$/, 'Telefone deve estar em formato +55 com DDD'),
  sessionPriceReais: z.coerce
    .number({ invalid_type_error: 'Informe o valor da sessão' })
    .nonnegative('Valor inválido'),
  notes: z.string(),
  active: z.boolean().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

export interface PatientFormValues {
  fullName: string;
  address: string;
  phone: string;
  sessionPriceCents: number;
  notes: string | null;
  active?: boolean;
}

interface Props {
  initial?: PatientDto;
  onSubmit: (values: PatientFormValues) => Promise<void> | void;
  onCancel: () => void;
}

export function PatientForm({ initial, onSubmit, onCancel }: Props) {
  const isEdit = initial !== undefined;
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      fullName: initial?.fullName ?? '',
      address: initial?.address ?? '',
      phone: initial?.phone ?? '',
      sessionPriceReais: initial ? initial.sessionPriceCents / 100 : ('' as unknown as number),
      notes: initial?.notes ?? '',
      active: initial?.active ?? true,
    },
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    const payload: PatientFormValues = {
      fullName: values.fullName.trim(),
      address: values.address.trim(),
      phone: values.phone.trim(),
      sessionPriceCents: Math.round(values.sessionPriceReais * 100),
      notes: values.notes.trim() === '' ? null : values.notes.trim(),
    };
    if (isEdit) payload.active = values.active ?? true;
    try {
      await onSubmit(payload);
    } catch {
      setServerError('Erro ao salvar paciente');
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium">
          Nome completo
        </label>
        <input
          id="fullName"
          type="text"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          {...register('fullName')}
        />
        {errors.fullName && (
          <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium">
          Endereço
        </label>
        <input
          id="address"
          type="text"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          {...register('address')}
        />
        {errors.address && (
          <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium">
          Telefone (WhatsApp)
        </label>
        <input
          id="phone"
          type="text"
          placeholder="+5521987654321"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          {...register('phone')}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="sessionPriceReais" className="block text-sm font-medium">
          Valor da sessão (R$)
        </label>
        <input
          id="sessionPriceReais"
          type="number"
          step="0.01"
          min="0"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          {...register('sessionPriceReais')}
        />
        {errors.sessionPriceReais && (
          <p className="mt-1 text-sm text-red-600">{errors.sessionPriceReais.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          Observações
        </label>
        <textarea
          id="notes"
          rows={3}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          {...register('notes')}
        />
      </div>

      {isEdit && (
        <div className="flex items-center gap-2">
          <input id="active" type="checkbox" {...register('active')} />
          <label htmlFor="active" className="text-sm font-medium">
            Ativo
          </label>
        </div>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-red-600">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
