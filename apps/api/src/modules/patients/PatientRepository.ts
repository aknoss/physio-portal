import type { Patient } from './Patient.js';

export type CreatePatientInput = {
  fullName: string;
  address: string;
  phone: string;
  sessionPriceCents: number;
  notes: string | null;
};

export type UpdatePatientInput = Partial<{
  fullName: string;
  address: string;
  phone: string;
  sessionPriceCents: number;
  notes: string | null;
  active: boolean;
}>;

export type ListPatientsFilter = {
  active?: boolean;
  search?: string;
};

export interface PatientRepository {
  create(input: CreatePatientInput): Promise<Patient>;
  findById(id: string): Promise<Patient | null>;
  list(filter: ListPatientsFilter): Promise<Patient[]>;
  update(id: string, input: UpdatePatientInput): Promise<Patient | null>;
  deactivate(id: string): Promise<Patient | null>;
}
