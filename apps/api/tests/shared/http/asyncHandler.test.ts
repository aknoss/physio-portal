import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { asyncHandler } from '../../../src/shared/http/asyncHandler.js';

describe('asyncHandler', () => {
  it('forwards rejected promises to next()', async () => {
    const boom = new Error('boom');
    const handler = asyncHandler(async () => {
      throw boom;
    });
    const next = vi.fn();
    handler({} as Request, {} as Response, next as unknown as NextFunction);
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('does not call next() when the handler resolves', async () => {
    const handler = asyncHandler(async () => undefined);
    const next = vi.fn();
    handler({} as Request, {} as Response, next as unknown as NextFunction);
    await new Promise((r) => setImmediate(r));
    expect(next).not.toHaveBeenCalled();
  });
});
