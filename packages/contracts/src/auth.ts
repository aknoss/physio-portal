import { z } from 'zod';

export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const UpdateProfileRequest = z.object({
  fullName: z.string().min(1),
  cref: z.string().min(1),
});

export const UserDto = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  cref: z.string(),
  signatureUrl: z.string().nullable(),
});

export const LoginResponse = z.object({
  token: z.string(),
  user: UserDto,
});

export type LoginRequest = z.infer<typeof LoginRequest>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;
export type UserDto = z.infer<typeof UserDto>;
export type LoginResponse = z.infer<typeof LoginResponse>;
