import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { ValidationError } from '../http/HttpError.js';

export function validate<S extends ZodTypeAny>(schema: S): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError('Validation failed', result.error.issues));
      return;
    }
    req.body = result.data as z.infer<S>;
    next();
  };
}
