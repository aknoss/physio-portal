import type { Schedule } from './Schedule.js';

export type UpsertScheduleInput = {
  patientId: string;
  weekdays: number[];
  startDate: string;
  endDate: string | null;
};

export interface ScheduleRepository {
  upsert(input: UpsertScheduleInput): Promise<Schedule>;
  findByPatientId(patientId: string): Promise<Schedule | null>;
}
