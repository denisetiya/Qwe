import { HttpException } from './http-exception.js';

export const UNAUTHORIZED_CODE = 'UNAUTHORIZED';

export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized', details?: unknown, code?: string) {
    super(401, message, code ?? UNAUTHORIZED_CODE, details);
  }
}
