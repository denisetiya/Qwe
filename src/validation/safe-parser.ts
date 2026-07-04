import type { Schema, Infer, ValidationError } from './types.js';

export type SafeParseSuccess<T> = {
  success: true;
  data: T;
  error: undefined;
};

export type SafeParseFailure = {
  success: false;
  data: undefined;
  error: { errors: ValidationError[] };
};

export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

export function safeParse<S extends Schema<unknown>>(schema: S, data: unknown): SafeParseResult<Infer<S>> {
  const result = schema._validate(data, []);
  if (!result.ok) {
    return { success: false, data: undefined, error: { errors: result.errors } };
  }
  return { success: true, data: result.value as Infer<S>, error: undefined };
}

export async function safeParseAsync<S extends Schema<unknown>>(
  schema: S,
  data: unknown,
): Promise<SafeParseResult<Infer<S>>> {
  return safeParse(schema, data);
}
