import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../http/HttpError.js';
import type { TokenSigner } from '../tokens/TokenSigner.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export function createAuthMiddleware(signer: TokenSigner): RequestHandler {
  return (req, _res, next) => {
    const header = req.header('authorization');
    if (!header || !header.startsWith('Bearer ')) {
      next(new UnauthorizedError('Missing or malformed Authorization header'));
      return;
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = signer.verify(token);
      req.userId = payload.userId;
      next();
    } catch {
      next(new UnauthorizedError('Invalid token'));
    }
  };
}
