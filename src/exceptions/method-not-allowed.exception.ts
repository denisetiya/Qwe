import { HttpException } from './http-exception.js';

export const METHOD_NOT_ALLOWED_CODE = 'METHOD_NOT_ALLOWED';

export class MethodNotAllowedException extends HttpException {
  readonly allowedMethods: string[];

  constructor(
    allowedMethods: string[],
    message?: string,
    details?: unknown,
    code?: string,
  ) {
    super(
      405,
      message ?? `Method not allowed. Allowed: ${allowedMethods.join(', ')}`,
      code ?? METHOD_NOT_ALLOWED_CODE,
      details,
    );
    this.allowedMethods = allowedMethods;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      allowedMethods: this.allowedMethods,
    };
  }
}
