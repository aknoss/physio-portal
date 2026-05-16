import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PatientDto } from '@physio-portal/contracts';
import { PatientForm } from './PatientForm';

const EXISTING: PatientDto = {
  id: '11111111-1111-1111-1111-111111111111',
  fullName: 'João da Silva',
  address: 'Rua A, 100',
  phone: '+5521987654321',
  sessionPriceCents: 12000,
  notes: 'Observação antiga',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('PatientForm', () => {
  it('renders PT-BR labels for create mode and hides the active toggle', () => {
    render(<PatientForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/endereço/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/telefone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/valor da sessão/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/observações/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/ativo/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty fields', async () => {
    const onSubmit = vi.fn();
    render(<PatientForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(await screen.findByText(/informe o nome/i)).toBeInTheDocument();
    expect(await screen.findByText(/informe o endereço/i)).toBeInTheDocument();
    expect(await screen.findByText(/telefone deve conter apenas números/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('converts price in reais to cents and sends notes as null when blank', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PatientForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/nome completo/i), 'Maria');
    await userEvent.type(screen.getByLabelText(/endereço/i), 'Av. B, 200');
    await userEvent.type(screen.getByLabelText(/telefone/i), '+5521912345678');
    await userEvent.type(screen.getByLabelText(/valor da sessão/i), '150.50');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      fullName: 'Maria',
      address: 'Av. B, 200',
      phone: '+5521912345678',
      sessionPriceCents: 15050,
      notes: null,
    });
  });

  it('prefills fields and shows the active toggle when editing', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PatientForm initial={EXISTING} onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/nome completo/i)).toHaveValue('João da Silva');
    expect(screen.getByLabelText(/endereço/i)).toHaveValue('Rua A, 100');
    expect(screen.getByLabelText(/telefone/i)).toHaveValue('+5521987654321');
    expect(screen.getByLabelText(/valor da sessão/i)).toHaveValue(120);
    expect(screen.getByLabelText(/observações/i)).toHaveValue('Observação antiga');
    const activeToggle = screen.getByLabelText(/ativo/i) as HTMLInputElement;
    expect(activeToggle.checked).toBe(true);
    await userEvent.click(activeToggle);
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      fullName: 'João da Silva',
      sessionPriceCents: 12000,
      notes: 'Observação antiga',
      active: false,
    });
  });

  it('invokes onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(<PatientForm onSubmit={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows a server error message when onSubmit throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('boom'));
    render(<PatientForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/nome completo/i), 'Maria');
    await userEvent.type(screen.getByLabelText(/endereço/i), 'Av. B, 200');
    await userEvent.type(screen.getByLabelText(/telefone/i), '+5521912345678');
    await userEvent.type(screen.getByLabelText(/valor da sessão/i), '100');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/erro ao salvar/i);
  });
});
