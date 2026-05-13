import type {
  CreatePatientRequest,
  ListPatientsQuery,
  PatientDto,
  UpdatePatientRequest,
} from '@physio-portal/contracts';
import { apiClient } from './client';

export async function listPatients(query?: ListPatientsQuery): Promise<PatientDto[]> {
  const params: Record<string, string> = {};
  if (query?.active !== undefined) params.active = String(query.active);
  if (query?.search) params.search = query.search;
  const { data } = await apiClient.get('/patients', { params });
  return data as PatientDto[];
}

export async function createPatient(body: CreatePatientRequest): Promise<PatientDto> {
  const { data } = await apiClient.post('/patients', body);
  return data as PatientDto;
}

export async function updatePatient(
  id: string,
  body: UpdatePatientRequest,
): Promise<PatientDto> {
  const { data } = await apiClient.patch(`/patients/${id}`, body);
  return data as PatientDto;
}

export async function deactivatePatient(id: string): Promise<PatientDto> {
  const { data } = await apiClient.delete(`/patients/${id}`);
  return data as PatientDto;
}
