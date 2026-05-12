import { NotFoundError } from '../../shared/http/HttpError.js';
import {
  enumerateDates,
  maxIsoDate,
  minIsoDate,
  weekdayOfIsoDate,
} from '../../shared/dates/dateRange.js';
import type { PatientRepository } from '../patients/PatientRepository.js';
import type { ScheduleRepository } from '../schedule/ScheduleRepository.js';
import type { Session } from './Session.js';
import type {
  CreateSessionInput,
  SessionRepository,
  UpdateSessionInput,
} from './SessionRepository.js';

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly schedules: ScheduleRepository,
    private readonly patients: PatientRepository,
  ) {}

  async generate(patientId: string, from: string, to: string): Promise<Session[]> {
    const patient = await this.patients.findById(patientId);
    if (!patient) throw new NotFoundError('Patient not found');
    const schedule = await this.schedules.findByPatientId(patientId);
    if (!schedule) throw new NotFoundError('Schedule not found');

    const effectiveFrom = maxIsoDate(from, schedule.startDate);
    const effectiveTo = schedule.endDate ? minIsoDate(to, schedule.endDate) : to;
    const allowed = new Set(schedule.weekdays);

    const inputs: CreateSessionInput[] = [];
    for (const date of enumerateDates(effectiveFrom, effectiveTo)) {
      if (allowed.has(weekdayOfIsoDate(date))) {
        inputs.push({ patientId, date, priceCents: patient.sessionPriceCents });
      }
    }

    await this.sessions.bulkCreateScheduled(inputs);
    return this.sessions.listByPatientInRange(patientId, from, to);
  }

  async updateStatus(id: string, input: UpdateSessionInput): Promise<Session> {
    const updated = await this.sessions.update(id, input);
    if (!updated) throw new NotFoundError('Session not found');
    return updated;
  }
}
