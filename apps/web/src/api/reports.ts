import type { PatientReportDto, ReportSummaryDto } from '@physio-portal/contracts';
import { apiClient } from './client';

export async function getSummary(from: string, to: string): Promise<ReportSummaryDto> {
  const { data } = await apiClient.get('/reports/summary', { params: { from, to } });
  return data as ReportSummaryDto;
}

export async function getPatientSummary(
  patientId: string,
  from: string,
  to: string,
): Promise<PatientReportDto> {
  const { data } = await apiClient.get(`/reports/patient/${patientId}`, {
    params: { from, to },
  });
  return data as PatientReportDto;
}
