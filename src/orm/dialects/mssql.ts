import type { DbType, WhereNode, OrderItem } from '../types.js';
import type { CompiledQuery } from '../types.js';
import { SqlDialect } from './sql-dialect.js';

export class MSSQLDialect extends SqlDialect {
  readonly type: DbType = 'mssql';

  escape(column: string): string {
    if (column === '*') return '*';
    const parts = column.split('.');
    return parts.map((p) => `[${p}]`).join('.');
  }

  placeholder(index: number): string {
    return `@P${index + 1}`;
  }

  quoteTable(name: string): string {
    return `[${name}]`;
  }

  supportsReturning(): boolean {
    return false;
  }

  override compileSelect(
    table: string,
    columns: string[],
    where: WhereNode | null,
    orderBy: OrderItem[],
    limit: number | null,
    offset: number | null,
    distinct?: string[],
  ): CompiledQuery {
    const params: unknown[] = [];
    const selectPart = columns.map((c) => (c === '*' ? '*' : this.escape(c))).join(', ');

    const topClause = limit !== null && offset === null ? ` TOP (${limit})` : '';
    let sql = `SELECT${distinct ? ' DISTINCT' : ''}${topClause} ${selectPart} FROM ${this.quoteTable(table)}`;

    if (where) {
      const whereClause = this.compileWhere(where, params);
      if (whereClause) sql += ` WHERE ${whereClause}`;
    }

    if (orderBy.length > 0) {
      sql += ` ORDER BY ${orderBy.map((o) => `${this.escape(o.field)} ${o.direction.toUpperCase()}`).join(', ')}`;
    }

    if (offset !== null && limit !== null) {
      sql += ` OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    } else if (offset !== null) {
      sql += ` OFFSET ${offset} ROWS`;
    }

    return { sql, params, cacheKey: sql };
  }

  override compileUpdate(
    table: string,
    data: Record<string, unknown>,
    where: WhereNode | null,
    returning?: string[],
  ): CompiledQuery {
    const params: unknown[] = [];
    const setClauses = Object.entries(data).map(([key, val]) => {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        const fieldOps = val as Record<string, unknown>;
        if ('increment' in fieldOps) {
          params.push(fieldOps.increment);
          return `${this.escape(key)} = ${this.escape(key)} + ${this.placeholder(params.length - 1)}`;
        }
        if ('decrement' in fieldOps) {
          params.push(fieldOps.decrement);
          return `${this.escape(key)} = ${this.escape(key)} - ${this.placeholder(params.length - 1)}`;
        }
      }
      params.push(val);
      return `${this.escape(key)} = ${this.placeholder(params.length - 1)}`;
    });

    let sql = `UPDATE ${this.quoteTable(table)} SET ${setClauses.join(', ')}`;

    if (returning) {
      sql += ` OUTPUT ${returning.map((c) => `inserted.${c === '*' ? '*' : this.escape(c)}`).join(', ')}`;
    }

    if (where) {
      const whereClause = this.compileWhere(where, params);
      if (whereClause) sql += ` WHERE ${whereClause}`;
    }

    return { sql, params, cacheKey: sql };
  }

  override compileDelete(
    table: string,
    where: WhereNode | null,
    returning?: string[],
  ): CompiledQuery {
    const params: unknown[] = [];
    let sql = `DELETE FROM ${this.quoteTable(table)}`;

    if (returning) {
      sql += ` OUTPUT ${returning.map((c) => `deleted.${c === '*' ? '*' : this.escape(c)}`).join(', ')}`;
    }

    if (where) {
      const whereClause = this.compileWhere(where, params);
      if (whereClause) sql += ` WHERE ${whereClause}`;
    }

    return { sql, params, cacheKey: sql };
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

    let sql = `MERGE INTO ${this.quoteTable(table)} AS target USING (VALUES (${vals.join(', ')})) AS source (${escapedKeys.join(', ')}) ON `;
    sql += conflictKeys.map((k) => `target.${this.escape(k)} = source.${this.escape(k)}`).join(' AND ');

    sql += ' WHEN MATCHED THEN UPDATE SET ';
    const updateClauses = Object.entries(updateFields).map(([key, val]) => {
      params.push(val);
      return `target.${this.escape(key)} = ${this.placeholder(params.length - 1)}`;
    });
    sql += updateClauses.join(', ');

    sql += ' WHEN NOT MATCHED THEN INSERT (';
    sql += escapedKeys.join(', ');
    sql += ') VALUES (';
    sql += keys.map((k) => `source.${this.escape(k)}`).join(', ');
    sql += ')';

    if (returning) {
      sql += ` OUTPUT ${returning.map((c) => `inserted.${c === '*' ? '*' : this.escape(c)}`).join(', ')}`;
    }

    sql += ';';

    return { sql, params, cacheKey: sql };
  }
}
