import { HttpException } from './http-exception.js';

export const CONFLICT_CODE = 'CONFLICT';

export class ConflictException extends HttpException {
  constructor(message = 'Conflict', details?: unknown, code?: string) {
    super(409, message, code ?? CONFLICT_CODE, details);
  }
}
