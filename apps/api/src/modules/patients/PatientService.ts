import { NotFoundError } from '../../shared/http/HttpError.js';
import type { Patient } from './Patient.js';
import type {
  CreatePatientInput,
  ListPatientsFilter,
  PatientRepository,
  UpdatePatientInput,
} from './PatientRepository.js';

export class PatientService {
  constructor(private readonly patients: PatientRepository) {}

  create(input: CreatePatientInput): Promise<Patient> {
    return this.patients.create(input);
  }

  async getById(id: string): Promise<Patient> {
    const found = await this.patients.findById(id);
    if (!found) throw new NotFoundError('Patient not found');
    return found;
  }

  list(filter: ListPatientsFilter): Promise<Patient[]> {
    return this.patients.list(filter);
  }

  async update(id: string, input: UpdatePatientInput): Promise<Patient> {
    const updated = await this.patients.update(id, input);
    if (!updated) throw new NotFoundError('Patient not found');
    return updated;
  }

  async deactivate(id: string): Promise<Patient> {
    const updated = await this.patients.deactivate(id);
    if (!updated) throw new NotFoundError('Patient not found');
    return updated;
  }
}
