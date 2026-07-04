import type { DbType, WhereNode } from '../types.js';
import type { CompiledQuery } from '../types.js';
import { SqlDialect } from './sql-dialect.js';

export class MySQLDialect extends SqlDialect {
  readonly type: DbType = 'mysql';

  escape(column: string): string {
    if (column === '*') return '*';
    const parts = column.split('.');
    return parts.map((p) => '`' + p + '`').join('.');
  }

  placeholder(_index: number): string {
    return '?';
  }

  supportsReturning(): boolean {
    return false;
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
    const query = super.compileSelect(table, columns, where, orderBy, limit, offset, distinct);
    return query;
  }

  override compileInsert(
    table: string,
    data: Record<string, unknown>[],
    _returning?: string[],
    skipDuplicates?: boolean,
  ): CompiledQuery {
    const result = super.compileInsert(table, data, undefined, skipDuplicates);
    if (skipDuplicates) {
      result.sql = result.sql.replace('ON CONFLICT DO NOTHING', 'IGNORE');
    }
    return result;
  }

  override compileUpsert(
    table: string,
    data: Record<string, unknown>,
    _conflictKeys: string[],
    updateFields: Record<string, unknown>,
    _returning?: string[],
  ): CompiledQuery {
    const params: unknown[] = [];
    const keys = Object.keys(data);
    const escapedKeys = keys.map((k) => this.escape(k));
    const vals = keys.map((k) => {
      params.push(data[k]);
      return this.placeholder(params.length - 1);
    });

    let sql = `INSERT INTO ${this.quoteTable(table)} (${escapedKeys.join(', ')}) VALUES (${vals.join(', ')})`;
    sql += ' ON DUPLICATE KEY UPDATE ';

    const updateClauses = Object.entries(updateFields).map(([key, val]) => {
      params.push(val);
      return `${this.escape(key)} = ${this.placeholder(params.length - 1)}`;
    });
    sql += updateClauses.join(', ');

    return { sql, params, cacheKey: sql };
  }
}
