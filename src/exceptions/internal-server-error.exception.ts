import { HttpException } from './http-exception.js';

export const INTERNAL_SERVER_ERROR_CODE = 'INTERNAL_SERVER_ERROR';

export class InternalServerErrorException extends HttpException {
  constructor(
    message = 'Internal Server Error',
    details?: unknown,
    code?: string,
  ) {
    super(500, message, code ?? INTERNAL_SERVER_ERROR_CODE, details);
  }
}
