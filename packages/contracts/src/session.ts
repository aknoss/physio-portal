import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be ISO 8601 calendar date (YYYY-MM-DD)');

export const SessionStatus = z.enum(['SCHEDULED', 'COMPLETED', 'MISSED', 'RESCHEDULED']);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const UpdatableSessionStatus = z.enum(['COMPLETED', 'MISSED', 'RESCHEDULED']);
export type UpdatableSessionStatus = z.infer<typeof UpdatableSessionStatus>;

export const UpdateSessionRequest = z
  .object({
    status: UpdatableSessionStatus.optional(),
    note: z.string().nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.note !== undefined, {
    message: 'At least one field must be provided',
  });

export type UpdateSessionRequest = z.infer<typeof UpdateSessionRequest>;

export const GenerateSessionsRequest = z
  .object({
    from: isoDate,
    to: isoDate,
  })
  .refine((v) => v.from <= v.to, {
    message: 'from must be on or before to',
    path: ['to'],
  });

export const SessionDto = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  date: z.string(),
  status: SessionStatus,
  priceCents: z.number().int().nonnegative(),
  note: z.string().nullable(),
});

export type GenerateSessionsRequest = z.infer<typeof GenerateSessionsRequest>;
export type SessionDto = z.infer<typeof SessionDto>;
