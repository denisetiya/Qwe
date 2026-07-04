import type { CompiledQuery, DbType, OrderItem, WhereNode } from '../types.js';

export interface Dialect {
  readonly type: DbType;

  escape(column: string): string;

  placeholder(index: number): string;

  quoteTable(name: string): string;

  compileSelect(
    table: string,
    columns: string[],
    where: WhereNode | null,
    orderBy: OrderItem[],
    limit: number | null,
    offset: number | null,
    distinct?: string[],
  ): CompiledQuery;

  compileInsert(
    table: string,
    data: Record<string, unknown>[],
    returning?: string[],
    skipDuplicates?: boolean,
  ): CompiledQuery;

  compileUpdate(
    table: string,
    data: Record<string, unknown>,
    where: WhereNode | null,
    returning?: string[],
  ): CompiledQuery;

  compileDelete(
    table: string,
    where: WhereNode | null,
    returning?: string[],
  ): CompiledQuery;

  compileUpsert(
    table: string,
    data: Record<string, unknown>,
    conflictKeys: string[],
    updateFields: Record<string, unknown>,
    returning?: string[],
  ): CompiledQuery;

  compileCount(
    table: string,
    where: WhereNode | null,
    field?: string,
  ): CompiledQuery;

  compileAggregate(
    table: string,
    where: WhereNode | null,
    aggregations: { fn: string; field: string; alias: string }[],
  ): CompiledQuery;

  compileGroupBy(
    table: string,
    by: string[],
    where: WhereNode | null,
    aggregations: { fn: string; field: string; alias: string }[],
    having: WhereNode | null,
    orderBy: OrderItem[],
    limit: number | null,
    offset: number | null,
  ): CompiledQuery;

  supportsReturning(): boolean;
}
