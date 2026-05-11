import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createAuthMiddleware } from '../../../src/shared/middleware/authMiddleware.js';
import { UnauthorizedError } from '../../../src/shared/http/HttpError.js';
import { FakeTokenSigner } from '../../helpers/fakes.js';

function reqWithHeader(value?: string): Request {
  return {
    header(name: string) {
      return name.toLowerCase() === 'authorization' ? value : undefined;
    },
  } as unknown as Request;
}

describe('authMiddleware', () => {
  const signer = new FakeTokenSigner();
  const middleware = createAuthMiddleware(signer);

  it('attaches userId from a valid Bearer token and calls next()', () => {
    const next: NextFunction = vi.fn();
    const req = reqWithHeader('Bearer token:user-1');
    middleware(req, {} as Response, next);
    expect(req.userId).toBe('user-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards Unauthorized when the Authorization header is missing', () => {
    const next = vi.fn() as unknown as NextFunction;
    middleware(reqWithHeader(undefined), {} as Response, next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it('forwards Unauthorized when the scheme is not Bearer', () => {
    const next = vi.fn() as unknown as NextFunction;
    middleware(reqWithHeader('Basic abc'), {} as Response, next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });

  it('forwards Unauthorized when the token is invalid', () => {
    const next = vi.fn() as unknown as NextFunction;
    middleware(reqWithHeader('Bearer garbage'), {} as Response, next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(err).toBeInstanceOf(UnauthorizedError);
  });
});
