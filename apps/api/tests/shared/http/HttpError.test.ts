import { describe, expect, it } from 'vitest';
import {
  HttpError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../src/shared/http/HttpError.js';

describe('HttpError', () => {
  it('captures status and message', () => {
    const err = new HttpError(500, 'oops');
    expect(err.status).toBe(500);
    expect(err.message).toBe('oops');
    expect(err.name).toBe('HttpError');
    expect(err).toBeInstanceOf(Error);
  });

  it('UnauthorizedError defaults to 401', () => {
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.message).toBe('Unauthorized');
    expect(err.name).toBe('UnauthorizedError');
  });

  it('UnauthorizedError accepts a custom message', () => {
    expect(new UnauthorizedError('Bad token').message).toBe('Bad token');
  });

  it('NotFoundError defaults to 404', () => {
    const err = new NotFoundError();
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not Found');
    expect(err.name).toBe('NotFoundError');
  });

  it('NotFoundError accepts a custom message', () => {
    expect(new NotFoundError('User not found').message).toBe('User not found');
  });

  it('ValidationError defaults to 400 with optional issues payload', () => {
    const issues = [{ path: ['email'], message: 'required' }];
    const err = new ValidationError('Validation failed', issues);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Validation failed');
    expect(err.issues).toEqual(issues);
    expect(err.name).toBe('ValidationError');
  });

  it('ValidationError uses default message when none given', () => {
    expect(new ValidationError().message).toBe('Validation failed');
  });
});
