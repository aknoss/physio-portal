import type { UserRepository } from '../modules/auth/UserRepository.js';
import type { PasswordHasher } from '../shared/crypto/PasswordHasher.js';

export type SeedInput = {
  email: string;
  password: string;
  fullName: string;
  cref: string;
};

export type SeedResult = { action: 'created' | 'skipped' };

export async function seed(
  users: UserRepository,
  hasher: PasswordHasher,
  input: SeedInput,
): Promise<SeedResult> {
  const existing = await users.findByEmail(input.email);
  if (existing) return { action: 'skipped' };
  const passwordHash = await hasher.hash(input.password);
  await users.create({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    cref: input.cref,
  });
  return { action: 'created' };
}
