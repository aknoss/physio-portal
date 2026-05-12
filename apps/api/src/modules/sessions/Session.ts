import type { SessionStatus } from '@physio-portal/contracts';

export type Session = {
  id: string;
  patientId: string;
  date: string;
  status: SessionStatus;
  priceCents: number;
  note: string | null;
};
