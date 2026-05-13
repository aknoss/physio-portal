import axios from 'axios';
import type { ScheduleDto, UpsertScheduleRequest } from '@physio-portal/contracts';
import { apiClient } from './client';

export async function getSchedule(patientId: string): Promise<ScheduleDto | null> {
  try {
    const { data } = await apiClient.get(`/patients/${patientId}/schedule`);
    return data as ScheduleDto;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function upsertSchedule(
  patientId: string,
  body: UpsertScheduleRequest,
): Promise<ScheduleDto> {
  const { data } = await apiClient.put(`/patients/${patientId}/schedule`, body);
  return data as ScheduleDto;
}
