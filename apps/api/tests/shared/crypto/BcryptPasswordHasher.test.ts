import { describe, expect, it } from 'vitest';
import { BcryptPasswordHasher } from '../../../src/shared/crypto/BcryptPasswordHasher.js';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('hashes a password to a non-plaintext string and verifies it', async () => {
    const hashed = await hasher.hash('senha123');
    expect(hashed).not.toBe('senha123');
    expect(await hasher.verify('senha123', hashed)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hashed = await hasher.hash('correto');
    expect(await hasher.verify('errado', hashed)).toBe(false);
  });
});
