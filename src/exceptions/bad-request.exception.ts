import { HttpException } from './http-exception.js';

export const BAD_REQUEST_CODE = 'BAD_REQUEST';

export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request', details?: unknown, code?: string) {
    super(400, message, code ?? BAD_REQUEST_CODE, details);
  }
}
