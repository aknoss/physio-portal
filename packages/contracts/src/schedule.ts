import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be ISO 8601 calendar date (YYYY-MM-DD)');

const weekday = z.number().int().min(0).max(6);

export const UpsertScheduleRequest = z
  .object({
    weekdays: z
      .array(weekday)
      .min(1, 'At least one weekday is required')
      .refine((v) => new Set(v).size === v.length, { message: 'Weekdays must be unique' }),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
  })
  .refine((v) => v.endDate == null || v.endDate >= v.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

export const ScheduleDto = z.object({
  patientId: z.string().uuid(),
  weekdays: z.array(weekday),
  startDate: z.string(),
  endDate: z.string().nullable(),
});

export type UpsertScheduleRequest = z.infer<typeof UpsertScheduleRequest>;
export type ScheduleDto = z.infer<typeof ScheduleDto>;
