import { beforeEach, describe, expect, it } from 'vitest';
import { seed } from '../../src/db/seed.js';
import { FakePasswordHasher, InMemoryUserRepository } from '../helpers/fakes.js';

let users: InMemoryUserRepository;
let hasher: FakePasswordHasher;

beforeEach(() => {
  users = new InMemoryUserRepository();
  hasher = new FakePasswordHasher();
});

const input = {
  email: 'fisio@example.com',
  password: 'senha123',
  fullName: 'Dra. Raiany',
  cref: 'CREFITO-99999',
};

describe('seed', () => {
  it('creates the user on an empty database with a hashed password', async () => {
    const result = await seed(users, hasher, input);
    expect(result).toEqual({ action: 'created' });
    const stored = await users.findByEmail(input.email);
    expect(stored).not.toBeNull();
    expect(stored?.passwordHash).toBe('hashed:senha123');
    expect(stored?.fullName).toBe('Dra. Raiany');
    expect(stored?.cref).toBe('CREFITO-99999');
  });

  it('is idempotent: a second call skips when the user already exists', async () => {
    const first = await seed(users, hasher, input);
    const second = await seed(users, hasher, input);
    expect(first.action).toBe('created');
    expect(second.action).toBe('skipped');
  });
});
