import type {
  PatientRankingDto,
  PatientReportDto,
  ReportSummaryDto,
} from '@physio-portal/contracts';
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

export async function getRanking(from: string, to: string): Promise<PatientRankingDto> {
  const { data } = await apiClient.get('/reports/ranking', { params: { from, to } });
  return data as PatientRankingDto;
}

export async function downloadMonthlyReportPdf(
  patientId: string,
  month: string,
): Promise<Blob> {
  const { data } = await apiClient.get(`/reports/patient/${patientId}/monthly.pdf`, {
    params: { month },
    responseType: 'arraybuffer',
  });
  return new Blob([data as ArrayBuffer], { type: 'application/pdf' });
}
