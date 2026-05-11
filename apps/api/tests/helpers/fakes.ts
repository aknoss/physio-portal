import { randomUUID } from 'node:crypto';
import type { Clock } from '../../src/shared/clock/Clock.js';
import type { PasswordHasher } from '../../src/shared/crypto/PasswordHasher.js';
import type { FileStorage } from '../../src/shared/storage/FileStorage.js';
import type { TokenPayload, TokenSigner } from '../../src/shared/tokens/TokenSigner.js';
import type { User } from '../../src/modules/auth/User.js';
import type {
  CreateUserInput,
  UpdateProfileInput,
  UserRepository,
} from '../../src/modules/auth/UserRepository.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly rows: User[] = [];

  async create(input: CreateUserInput): Promise<User> {
    const user: User = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      cref: input.cref,
      signatureUrl: null,
      createdAt: new Date(),
    };
    this.rows.push(user);
    return { ...user };
  }

  async findByEmail(email: string): Promise<User | null> {
    const found = this.rows.find((u) => u.email === email);
    return found ? { ...found } : null;
  }

  async findById(id: string): Promise<User | null> {
    const found = this.rows.find((u) => u.id === id);
    return found ? { ...found } : null;
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<User | null> {
    const row = this.rows.find((u) => u.id === id);
    if (!row) return null;
    row.fullName = input.fullName;
    row.cref = input.cref;
    return { ...row };
  }

  async updateSignatureUrl(id: string, url: string): Promise<User | null> {
    const row = this.rows.find((u) => u.id === id);
    if (!row) return null;
    row.signatureUrl = url;
    return { ...row };
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    return hashed === `hashed:${plain}`;
  }
}

export class FakeTokenSigner implements TokenSigner {
  sign(payload: TokenPayload): string {
    return `token:${payload.userId}`;
  }

  verify(token: string): TokenPayload {
    if (!token.startsWith('token:')) throw new Error('invalid token');
    return { userId: token.slice('token:'.length) };
  }
}

export class FakeFileStorage implements FileStorage {
  readonly saved: { filename: string; content: Buffer }[] = [];

  async save(filename: string, content: Buffer): Promise<string> {
    this.saved.push({ filename, content });
    return `/uploads/${filename}`;
  }
}

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}

  now(): Date {
    return new Date(this.fixed);
  }
}
