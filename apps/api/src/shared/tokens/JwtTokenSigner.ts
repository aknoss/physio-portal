import jwt, { type SignOptions } from 'jsonwebtoken';
import type { TokenPayload, TokenSigner } from './TokenSigner.js';

type ExpiresIn = NonNullable<SignOptions['expiresIn']>;

export class JwtTokenSigner implements TokenSigner {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: ExpiresIn = '7d',
  ) {}

  sign(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  verify(token: string): TokenPayload {
    const decoded = jwt.verify(token, this.secret);
    if (typeof decoded === 'string' || typeof decoded.userId !== 'string') {
      throw new Error('Invalid token payload');
    }
    return { userId: decoded.userId };
  }
}
