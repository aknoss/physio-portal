import type { Session } from './Session.js';

export type CreateSessionInput = {
  patientId: string;
  date: string;
  priceCents: number;
};

export interface SessionRepository {
  bulkCreateScheduled(inputs: CreateSessionInput[]): Promise<Session[]>;
  listByPatientInRange(patientId: string, from: string, to: string): Promise<Session[]>;
}
