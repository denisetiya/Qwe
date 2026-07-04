import type { Schema, Infer, ValidationError } from './types.js';

export class QweValidationError extends Error {
  readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    const messages = errors.map((e) => {
      const p = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
      return `${p}${e.message}`;
    });
    super(`Validation failed: ${messages.join('; ')}`);
    this.name = 'QweValidationError';
    this.errors = errors;
  }
}

export function parse<S extends Schema<unknown>>(schema: S, data: unknown): Infer<S> {
  const result = schema._validate(data, []);
  if (!result.ok) {
    throw new QweValidationError(result.errors);
  }
  return result.value as Infer<S>;
}

export async function parseAsync<S extends Schema<unknown>>(schema: S, data: unknown): Promise<Infer<S>> {
  return parse(schema, data);
}
