import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import { validate } from '../../../src/shared/middleware/validate.js';
import { ValidationError } from '../../../src/shared/http/HttpError.js';

const schema = z.object({ email: z.string().email(), age: z.number().int().positive() });

describe('validate', () => {
  it('passes through when the payload matches the schema and replaces req.body with parsed data', () => {
    const next: NextFunction = vi.fn();
    const req = { body: { email: 'a@b.com', age: 30 } } as Request;
    validate(schema)(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'a@b.com', age: 30 });
  });

  it('forwards a ValidationError with Zod issues when the payload is invalid', () => {
    const next = vi.fn() as unknown as NextFunction;
    const req = { body: { email: 'not-email', age: -1 } } as Request;
    validate(schema)(req, {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.issues).toBeInstanceOf(Array);
    expect(err.issues.length).toBeGreaterThan(0);
  });
});
