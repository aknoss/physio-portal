import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be ISO 8601 calendar date (YYYY-MM-DD)');

export const ReportRangeQuery = z
  .object({
    from: isoDate,
    to: isoDate,
  })
  .refine((v) => v.from <= v.to, {
    message: 'from must be on or before to',
    path: ['to'],
  });

export const ReportSummaryDto = z.object({
  from: z.string(),
  to: z.string(),
  totalCents: z.number().int().nonnegative(),
  sessionCount: z.number().int().nonnegative(),
});

export const PatientReportDto = z.object({
  patientId: z.string().uuid(),
  from: z.string(),
  to: z.string(),
  totalCents: z.number().int().nonnegative(),
  sessionCount: z.number().int().nonnegative(),
});

export const PatientRankingItemDto = z.object({
  patientId: z.string().uuid(),
  fullName: z.string(),
  totalCents: z.number().int().nonnegative(),
  sessionCount: z.number().int().nonnegative(),
});

export const PatientRankingDto = z.array(PatientRankingItemDto);

export const MonthlyReportQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be in YYYY-MM format'),
});

export type ReportRangeQuery = z.infer<typeof ReportRangeQuery>;
export type ReportSummaryDto = z.infer<typeof ReportSummaryDto>;
export type PatientReportDto = z.infer<typeof PatientReportDto>;
export type PatientRankingItemDto = z.infer<typeof PatientRankingItemDto>;
export type PatientRankingDto = z.infer<typeof PatientRankingDto>;
export type MonthlyReportQuery = z.infer<typeof MonthlyReportQuery>;
