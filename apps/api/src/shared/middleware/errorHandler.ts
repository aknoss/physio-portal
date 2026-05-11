import type { ErrorRequestHandler } from 'express';
import { HttpError, ValidationError } from '../http/HttpError.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    res.status(err.status).json({ error: err.message, issues: err.issues });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Internal Server Error' });
};
