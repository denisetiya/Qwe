import { HttpException } from './http-exception.js';

export class TooManyRequestsException extends HttpException {
  readonly retryAfter: number | undefined;

  constructor(message = 'Too Many Requests', retryAfter?: number, code?: string) {
    super(429, message, code ?? 'TOO_MANY_REQUESTS');
    this.retryAfter = retryAfter;
  }

  override toJSON() {
    const base = super.toJSON();
    if (this.retryAfter !== undefined) {
      return { ...base, retryAfter: this.retryAfter };
    }
    return base;
  }
}
