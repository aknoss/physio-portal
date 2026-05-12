import type { SessionStatus } from '@physio-portal/contracts';
import type { Session } from './Session.js';

export type CreateSessionInput = {
  patientId: string;
  date: string;
  priceCents: number;
};

export type UpdateSessionInput = {
  status?: SessionStatus;
  note?: string | null;
};

export interface SessionRepository {
  bulkCreateScheduled(inputs: CreateSessionInput[]): Promise<Session[]>;
  listByPatientInRange(patientId: string, from: string, to: string): Promise<Session[]>;
  findById(id: string): Promise<Session | null>;
  update(id: string, input: UpdateSessionInput): Promise<Session | null>;
}
