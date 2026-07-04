import { HttpException } from './http-exception.js';

export const FORBIDDEN_CODE = 'FORBIDDEN';

export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden', details?: unknown, code?: string) {
    super(403, message, code ?? FORBIDDEN_CODE, details);
  }
}
