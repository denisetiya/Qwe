import type { ApiResponse, PaginationMeta, ValidationError } from './envelope.js';
import { createPaginationMeta } from './pagination.js';

export function success<T>(data: T, message?: string, meta?: PaginationMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(message !== undefined && { message }),
    ...(meta !== undefined && { meta }),
    timestamp: new Date().toISOString(),
  };
}

export function error(errors: ValidationError[], message?: string): ApiResponse<never> {
  return {
    success: false,
    errors,
    message: message ?? 'Validation Failed',
    timestamp: new Date().toISOString(),
  };
}

export function created<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message: message ?? 'Created',
    timestamp: new Date().toISOString(),
  };
}

export function paginated<T>(data: T[], page: number, limit: number, total: number): ApiResponse<T[]> {
  return {
    success: true,
    data,
    meta: createPaginationMeta(page, limit, total),
    timestamp: new Date().toISOString(),
  };
}
