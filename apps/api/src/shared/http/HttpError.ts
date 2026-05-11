export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends HttpError {
  constructor(
    message = 'Validation failed',
    public readonly issues?: unknown,
  ) {
    super(400, message);
    this.name = 'ValidationError';
  }
}
