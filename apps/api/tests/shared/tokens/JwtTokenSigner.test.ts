import { describe, expect, it } from 'vitest';
import { JwtTokenSigner } from '../../../src/shared/tokens/JwtTokenSigner.js';

describe('JwtTokenSigner', () => {
  it('signs a payload and verifies it back', () => {
    const signer = new JwtTokenSigner('test-secret', '1h');
    const token = signer.sign({ userId: 'user-1' });
    expect(token.split('.').length).toBe(3);
    expect(signer.verify(token)).toEqual({ userId: 'user-1' });
  });

  it('uses a default expiration when none is provided', () => {
    const signer = new JwtTokenSigner('test-secret');
    const token = signer.sign({ userId: 'user-2' });
    expect(signer.verify(token).userId).toBe('user-2');
  });

  it('throws when verifying a malformed token', () => {
    const signer = new JwtTokenSigner('test-secret');
    expect(() => signer.verify('not-a-token')).toThrow();
  });

  it('throws when verifying a token signed with a different secret', () => {
    const a = new JwtTokenSigner('alpha');
    const b = new JwtTokenSigner('beta');
    expect(() => b.verify(a.sign({ userId: 'u' }))).toThrow();
  });

  it('throws when the decoded payload has no userId', async () => {
    const jwt = await import('jsonwebtoken');
    const tok = jwt.default.sign({ something: 'else' }, 'secret');
    const signer = new JwtTokenSigner('secret');
    expect(() => signer.verify(tok)).toThrow(/invalid token payload/i);
  });

  it('throws when the decoded payload is a plain string', async () => {
    const jwt = await import('jsonwebtoken');
    const tok = jwt.default.sign('just-a-string', 'secret');
    const signer = new JwtTokenSigner('secret');
    expect(() => signer.verify(tok)).toThrow(/invalid token payload/i);
  });
});
