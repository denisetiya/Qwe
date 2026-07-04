import { HttpException } from './http-exception.js';
import type { ValidationError } from '../validation/types.js';

export class ValidationException extends HttpException {
  readonly errors: readonly ValidationError[];

  constructor(errors: ValidationError[], message?: string, code?: string) {
    super(422, message ?? 'Validation Failed', code ?? 'VALIDATION_ERROR');
    this.errors = errors;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }
}
