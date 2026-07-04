import type { PaginationMeta } from './envelope.js';

export function calculateOffset(page: number, limit: number): number {
  return (Math.max(1, page) - 1) * Math.max(1, limit);
}

export function calculateTotalPages(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, limit)));
}

export function createPaginationMeta(page: number, limit: number, total: number): Required<PaginationMeta> {
  return {
    page: Math.max(1, page),
    limit: Math.max(1, limit),
    total,
    totalPages: calculateTotalPages(total, limit),
  };
}
