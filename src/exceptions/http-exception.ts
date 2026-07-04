export class HttpException extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code ?? `HTTP_${status}`;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): {
    status: number;
    message: string;
    code: string;
    timestamp: string;
    details?: unknown;
  } {
    const base: {
      status: number;
      message: string;
      code: string;
      timestamp: string;
      details?: unknown;
    } = {
      status: this.status,
      message: this.message,
      code: this.code,
      timestamp: new Date().toISOString(),
    };

    if (this.details !== undefined) {
      base.details = this.details;
    }

    return base;
  }
}
