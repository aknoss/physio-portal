import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../../src/shared/middleware/errorHandler.js';
import {
  HttpError,
  NotFoundError,
  ValidationError,
} from '../../../src/shared/http/HttpError.js';

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

const next: NextFunction = vi.fn();
const req = {} as Request;

describe('errorHandler', () => {
  it('returns 400 with the issues payload for ValidationError', () => {
    const res = mockRes();
    const issues = [{ path: ['email'], message: 'required' }];
    errorHandler(new ValidationError('Bad', issues), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Bad', issues });
  });

  it('returns the status and message of an HttpError subclass', () => {
    const res = mockRes();
    errorHandler(new NotFoundError('No user'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'No user' });
  });

  it('returns 500 with a generic message for unexpected errors', () => {
    const res = mockRes();
    errorHandler(new Error('boom'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  });

  it('returns the status and message for a plain HttpError instance', () => {
    const res = mockRes();
    errorHandler(new HttpError(418, 'teapot'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json).toHaveBeenCalledWith({ error: 'teapot' });
  });
});
