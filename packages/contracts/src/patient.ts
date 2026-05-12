import { z } from 'zod';

const brPhone = z
  .string()
  .regex(/^\+55\d{10,11}$/, 'Phone must be E.164 BR (e.g. +5521987654321)');

export const CreatePatientRequest = z.object({
  fullName: z.string().min(1),
  address: z.string().min(1),
  phone: brPhone,
  sessionPriceCents: z.number().int().nonnegative(),
  notes: z.string().nullable().optional(),
});

export const UpdatePatientRequest = z
  .object({
    fullName: z.string().min(1),
    address: z.string().min(1),
    phone: brPhone,
    sessionPriceCents: z.number().int().nonnegative(),
    notes: z.string().nullable(),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

export const PatientDto = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  address: z.string(),
  phone: z.string(),
  sessionPriceCents: z.number().int(),
  notes: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
});

export const ListPatientsQuery = z.object({
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  search: z.string().trim().min(1).optional(),
});

export type CreatePatientRequest = z.infer<typeof CreatePatientRequest>;
export type UpdatePatientRequest = z.infer<typeof UpdatePatientRequest>;
export type PatientDto = z.infer<typeof PatientDto>;
export type ListPatientsQuery = z.infer<typeof ListPatientsQuery>;
