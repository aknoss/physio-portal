import type { SessionDto, UpdateSessionRequest } from '@physio-portal/contracts';
import { apiClient } from './client';

export async function listSessions(
  patientId: string,
  from: string,
  to: string,
): Promise<SessionDto[]> {
  const { data } = await apiClient.get(`/patients/${patientId}/sessions`, {
    params: { from, to },
  });
  return data as SessionDto[];
}

export async function generateSessions(
  patientId: string,
  from: string,
  to: string,
): Promise<SessionDto[]> {
  const { data } = await apiClient.post(`/patients/${patientId}/sessions/generate`, {
    from,
    to,
  });
  return data as SessionDto[];
}

export async function updateSession(
  sessionId: string,
  body: UpdateSessionRequest,
): Promise<SessionDto> {
  const { data } = await apiClient.patch(`/sessions/${sessionId}`, body);
  return data as SessionDto;
}
