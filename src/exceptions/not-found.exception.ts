import { HttpException } from './http-exception.js';

export const NOT_FOUND_CODE = 'NOT_FOUND';

export class NotFoundException extends HttpException {
  constructor(message = 'Not Found', details?: unknown, code?: string) {
    super(404, message, code ?? NOT_FOUND_CODE, details);
  }
}
