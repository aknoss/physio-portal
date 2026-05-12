import { NotFoundError } from '../../shared/http/HttpError.js';
import type { PatientRepository } from '../patients/PatientRepository.js';
import type { Schedule } from './Schedule.js';
import type { ScheduleRepository, UpsertScheduleInput } from './ScheduleRepository.js';

export class ScheduleService {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly patients: PatientRepository,
  ) {}

  async upsert(patientId: string, input: Omit<UpsertScheduleInput, 'patientId'>): Promise<Schedule> {
    const patient = await this.patients.findById(patientId);
    if (!patient) throw new NotFoundError('Patient not found');
    return this.schedules.upsert({ patientId, ...input });
  }

  async getByPatientId(patientId: string): Promise<Schedule> {
    const patient = await this.patients.findById(patientId);
    if (!patient) throw new NotFoundError('Patient not found');
    const schedule = await this.schedules.findByPatientId(patientId);
    if (!schedule) throw new NotFoundError('Schedule not found');
    return schedule;
  }
}
