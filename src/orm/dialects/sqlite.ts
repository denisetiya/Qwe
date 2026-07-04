import type { DbType, WhereNode } from '../types.js';
import type { CompiledQuery } from '../types.js';
import { SqlDialect } from './sql-dialect.js';

export class SQLiteDialect extends SqlDialect {
  readonly type: DbType = 'sqlite';

  escape(column: string): string {
    if (column === '*') return '*';
    const parts = column.split('.');
    return parts.map((p) => `"${p}"`).join('.');
  }

  placeholder(_index: number): string {
    return '?';
  }

  supportsReturning(): boolean {
    return true;
  }

  override compileInsert(
    table: string,
    data: Record<string, unknown>[],
    returning?: string[],
    skipDuplicates?: boolean,
  ): CompiledQuery {
    const result = super.compileInsert(table, data, returning, skipDuplicates);
    return result;
  }

  override compileUpsert(
    table: string,
    data: Record<string, unknown>,
    conflictKeys: string[],
    updateFields: Record<string, unknown>,
    returning?: string[],
  ): CompiledQuery {
    const params: unknown[] = [];
    const keys = Object.keys(data);
    const escapedKeys = keys.map((k) => this.escape(k));
    const vals = keys.map((k) => {
      params.push(data[k]);
      return this.placeholder(params.length - 1);
    });

    let sql = `INSERT INTO ${this.quoteTable(table)} (${escapedKeys.join(', ')}) VALUES (${vals.join(', ')})`;
    sql += ` ON CONFLICT (${conflictKeys.map((k) => this.escape(k)).join(', ')}) DO UPDATE SET `;

    const updateClauses = Object.entries(updateFields).map(([key, val]) => {
      params.push(val);
      return `${this.escape(key)} = ${this.placeholder(params.length - 1)}`;
    });
    sql += updateClauses.join(', ');

    if (returning && this.supportsReturning()) {
      sql += ` RETURNING ${returning.map((c) => (c === '*' ? '*' : this.escape(c))).join(', ')}`;
    }

    return { sql, params, cacheKey: sql };
  }

  override compileSelect(
    table: string,
    columns: string[],
    where: WhereNode | null,
    orderBy: { field: string; direction: 'asc' | 'desc' }[],
    limit: number | null,
    offset: number | null,
    distinct?: string[],
  ): CompiledQuery {
    return super.compileSelect(table, columns, where, orderBy, limit, offset, distinct);
  }
}
