import type { Dialect } from './dialect.js';
import type { CompiledQuery, DbType, OrderItem, WhereNode, WhereCondition, LogicalNode, RelationNode } from '../types.js';

abstract class SqlDialect implements Dialect {
  abstract readonly type: DbType;

  abstract escape(column: string): string;

  abstract placeholder(index: number): string;

  quoteTable(name: string): string {
    return this.escape(name);
  }

  supportsReturning(): boolean {
    return false;
  }

  compileSelect(
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
    let sql = `SELECT ${distinct ? 'DISTINCT ' : ''}${selectPart} FROM ${this.quoteTable(table)}`;

    if (where) {
      const whereClause = this.compileWhere(where, params);
      if (whereClause) sql += ` WHERE ${whereClause}`;
    }

    if (orderBy.length > 0) {
      sql += ` ORDER BY ${orderBy.map((o) => `${this.escape(o.field)} ${o.direction.toUpperCase()}`).join(', ')}`;
    }

    if (limit !== null) {
      params.push(limit);
      sql += ` LIMIT ${this.placeholder(params.length - 1)}`;
    }

    if (offset !== null) {
      params.push(offset);
      sql += ` OFFSET ${this.placeholder(params.length - 1)}`;
    }

    return { sql, params, cacheKey: sql };
  }

  compileInsert(
    table: string,
    data: Record<string, unknown>[],
    returning?: string[],
    skipDuplicates?: boolean,
  ): CompiledQuery {
    const params: unknown[] = [];
    const keys = Object.keys(data[0]!);
    const escapedKeys = keys.map((k) => this.escape(k));

    const valueSets = data.map((row) => {
      const vals = keys.map((k) => {
        params.push(row[k]);
        return this.placeholder(params.length - 1);
      });
      return `(${vals.join(', ')})`;
    });

    let sql = `INSERT INTO ${this.quoteTable(table)} (${escapedKeys.join(', ')}) VALUES ${valueSets.join(', ')}`;

    if (skipDuplicates) {
      sql += ' ON CONFLICT DO NOTHING';
    }

    if (returning && this.supportsReturning()) {
      const retCols = returning.map((c) => (c === '*' ? '*' : this.escape(c))).join(', ');
      sql += ` RETURNING ${retCols}`;
    }

    return { sql, params, cacheKey: sql };
  }

  compileUpdate(
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
        if ('multiply' in fieldOps) {
          params.push(fieldOps.multiply);
          return `${this.escape(key)} = ${this.escape(key)} * ${this.placeholder(params.length - 1)}`;
        }
        if ('divide' in fieldOps) {
          params.push(fieldOps.divide);
          return `${this.escape(key)} = ${this.escape(key)} / ${this.placeholder(params.length - 1)}`;
        }
      }
      params.push(val);
      return `${this.escape(key)} = ${this.placeholder(params.length - 1)}`;
    });

    let sql = `UPDATE ${this.quoteTable(table)} SET ${setClauses.join(', ')}`;

    if (where) {
      const whereClause = this.compileWhere(where, params);
      if (whereClause) sql += ` WHERE ${whereClause}`;
    }

    if (returning && this.supportsReturning()) {
      const retCols = returning.map((c) => (c === '*' ? '*' : this.escape(c))).join(', ');
      sql += ` RETURNING ${retCols}`;
    }

    return { sql, params, cacheKey: sql };
  }

  compileDelete(
    table: string,
    where: WhereNode | null,
    returning?: string[],
  ): CompiledQuery {
    const params: unknown[] = [];
    let sql = `DELETE FROM ${this.quoteTable(table)}`;

    if (where) {
      const whereClause = this.compileWhere(where, params);
      if (whereClause) sql += ` WHERE ${whereClause}`;
    }

    if (returning && this.supportsReturning()) {
      const retCols = returning.map((c) => (c === '*' ? '*' : this.escape(c))).join(', ');
      sql += ` RETURNING ${retCols}`;
    }

    return { sql, params, cacheKey: sql };
  }

  compileUpsert(
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
      const retCols = returning.map((c) => (c === '*' ? '*' : this.escape(c))).join(', ');
      sql += ` RETURNING ${retCols}`;
    }

    return { sql, params, cacheKey: sql };
  }

  compileCount(
    table: string,
    where: WhereNode | null,
    field?: string,
  ): CompiledQuery {
    const params: unknown[] = [];
    const countExpr = field ? `COUNT(${this.escape(field)})` : 'COUNT(*)';
    let sql = `SELECT ${countExpr} AS count FROM ${this.quoteTable(table)}`;

    if (where) {
      const whereClause = this.compileWhere(where, params);
      if (whereClause) sql += ` WHERE ${whereClause}`;
    }

    return { sql, params, cacheKey: sql };
  }

  compileAggregate(
    table: string,
    where: WhereNode | null,
    aggregations: { fn: string; field: string; alias: string }[],
  ): CompiledQuery {
    const params: unknown[] = [];
    const aggExprs = aggregations.map((a) => {
      const fieldExpr = a.field === '*' ? '*' : this.escape(a.field);
      return `${a.fn}(${fieldExpr}) AS ${this.escape(a.alias)}`;
    });
    let sql = `SELECT ${aggExprs.join(', ')} FROM ${this.quoteTable(table)}`;

    if (where) {
      const whereClause = this.compileWhere(where, params);
      if (whereClause) sql += ` WHERE ${whereClause}`;
    }

    return { sql, params, cacheKey: sql };
  }

  compileGroupBy(
    table: string,
    by: string[],
    where: WhereNode | null,
    aggregations: { fn: string; field: string; alias: string }[],
    having: WhereNode | null,
    orderBy: OrderItem[],
    limit: number | null,
    offset: number | null,
  ): CompiledQuery {
    const params: unknown[] = [];
    const selectParts = [
      ...by.map((f) => this.escape(f)),
      ...aggregations.map((a) => `${a.fn}(${a.field === '*' ? '*' : this.escape(a.field)}) AS ${this.escape(a.alias)}`),
    ];
    let sql = `SELECT ${selectParts.join(', ')} FROM ${this.quoteTable(table)}`;

    if (where) {
      const whereClause = this.compileWhere(where, params);
      if (whereClause) sql += ` WHERE ${whereClause}`;
    }

    sql += ` GROUP BY ${by.map((f) => this.escape(f)).join(', ')}`;

    if (having) {
      const havingClause = this.compileWhere(having, params);
      if (havingClause) sql += ` HAVING ${havingClause}`;
    }

    if (orderBy.length > 0) {
      sql += ` ORDER BY ${orderBy.map((o) => `${this.escape(o.field)} ${o.direction.toUpperCase()}`).join(', ')}`;
    }

    if (limit !== null) {
      params.push(limit);
      sql += ` LIMIT ${this.placeholder(params.length - 1)}`;
    }

    if (offset !== null) {
      params.push(offset);
      sql += ` OFFSET ${this.placeholder(params.length - 1)}`;
    }

    return { sql, params, cacheKey: sql };
  }

  protected compileWhere(node: WhereNode, params: unknown[]): string {
    if ('field' in node && 'op' in node) {
      return this.compileCondition(node as WhereCondition, params);
    }
    if ('type' in node && 'children' in node) {
      if ((node as LogicalNode).type) {
        return this.compileLogical(node as LogicalNode, params);
      }
    }
    if ('filter' in node) {
      return this.compileRelation(node as RelationNode, params);
    }
    return '';
  }

  compileCondition(node: WhereCondition, params: unknown[]): string {
    const col = this.escape(node.field);
    switch (node.op) {
      case 'eq':
        params.push(node.value);
        return `${col} = ${this.placeholder(params.length - 1)}`;
      case 'not':
        params.push(node.value);
        return `${col} != ${this.placeholder(params.length - 1)}`;
      case 'in': {
        const vals = node.value as unknown[];
        const placeholders = vals.map((v) => {
          params.push(v);
          return this.placeholder(params.length - 1);
        });
        return `${col} IN (${placeholders.join(', ')})`;
      }
      case 'notIn': {
        const vals = node.value as unknown[];
        const placeholders = vals.map((v) => {
          params.push(v);
          return this.placeholder(params.length - 1);
        });
        return `${col} NOT IN (${placeholders.join(', ')})`;
      }
      case 'gt':
        params.push(node.value);
        return `${col} > ${this.placeholder(params.length - 1)}`;
      case 'gte':
        params.push(node.value);
        return `${col} >= ${this.placeholder(params.length - 1)}`;
      case 'lt':
        params.push(node.value);
        return `${col} < ${this.placeholder(params.length - 1)}`;
      case 'lte':
        params.push(node.value);
        return `${col} <= ${this.placeholder(params.length - 1)}`;
      case 'contains':
        params.push(`%${node.value}%`);
        return `${col} LIKE ${this.placeholder(params.length - 1)}`;
      case 'startsWith':
        params.push(`${node.value}%`);
        return `${col} LIKE ${this.placeholder(params.length - 1)}`;
      case 'endsWith':
        params.push(`%${node.value}`);
        return `${col} LIKE ${this.placeholder(params.length - 1)}`;
      case 'isNull':
        return `${col} IS NULL`;
      case 'isNotNull':
        return `${col} IS NOT NULL`;
      case 'has':
        params.push(node.value);
        return `${this.placeholder(params.length - 1)} = ANY(${col})`;
      case 'hasEvery': {
        const vals = node.value as unknown[];
        vals.forEach((v) => params.push(v));
        return `${col} @> ARRAY[${vals.map((_, i) => this.placeholder(params.length - vals.length + i)).join(', ')}]`;
      }
      case 'hasSome': {
        const vals = node.value as unknown[];
        vals.forEach((v) => params.push(v));
        return `${col} && ARRAY[${vals.map((_, i) => this.placeholder(params.length - vals.length + i)).join(', ')}]`;
      }
      case 'isEmpty':
        return `array_length(${col}, 1) IS NULL`;
      default:
        params.push(node.value);
        return `${col} = ${this.placeholder(params.length - 1)}`;
    }
  }

  compileLogical(node: LogicalNode, params: unknown[]): string {
    if (node.type === 'NOT') {
      const inner = node.children.map((c) => this.compileWhere(c, params)).filter(Boolean);
      return inner.length > 0 ? `NOT (${inner.join(' AND ')})` : '1=1';
    }
    const parts = node.children.map((c) => this.compileWhere(c, params)).filter(Boolean);
    if (parts.length === 0) return '1=1';
    const op = node.type === 'AND' ? ' AND ' : ' OR ';
    return parts.length === 1 ? parts[0]! : `(${parts.join(op)})`;
  }

  compileRelation(node: RelationNode, _params: unknown[]): string {
    switch (node.filter) {
      case 'some': return `EXISTS (SELECT 1 FROM ${this.escape(node.field)})`;
      case 'every': return `NOT EXISTS (SELECT 1 FROM ${this.escape(node.field)} WHERE FALSE)`;
      case 'none': return `NOT EXISTS (SELECT 1 FROM ${this.escape(node.field)})`;
    }
  }
}

export { SqlDialect };
