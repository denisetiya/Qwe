export const HTTP_METHODS = Object.freeze({
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
  ANY: 'ANY',
} as const);

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'ANY';

const VALID_METHODS: ReadonlySet<string> = new Set(Object.values(HTTP_METHODS));

export function isValidMethod(method: string): method is HttpMethod {
  return VALID_METHODS.has(method.toUpperCase());
}

export function normalizeMethod(method: string): HttpMethod {
  const upper = method.toUpperCase();
  if (!VALID_METHODS.has(upper)) {
    throw new Error(`Invalid HTTP method: ${method}`);
  }
  return upper as HttpMethod;
}

export function hasBody(method: string): boolean {
  const m = method.toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

export function isIdempotent(method: string): boolean {
  const m = method.toUpperCase();
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS' || m === 'PUT' || m === 'DELETE';
}

export function isSafe(method: string): boolean {
  const m = method.toUpperCase();
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
}
