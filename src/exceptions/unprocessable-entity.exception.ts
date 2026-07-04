import { HttpException } from './http-exception.js';

export const UNPROCESSABLE_ENTITY_CODE = 'UNPROCESSABLE_ENTITY';

export class UnprocessableEntityException extends HttpException {
  constructor(
    message = 'Unprocessable Entity',
    details?: unknown,
    code?: string,
  ) {
    super(422, message, code ?? UNPROCESSABLE_ENTITY_CODE, details);
  }
}
