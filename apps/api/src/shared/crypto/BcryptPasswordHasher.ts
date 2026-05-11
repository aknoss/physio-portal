import bcrypt from 'bcrypt';
import type { PasswordHasher } from './PasswordHasher.js';

const ROUNDS = 10;

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, ROUNDS);
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
