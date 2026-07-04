import type { CompiledQuery, DbType, MongoQuery, OrderItem, SelectClause, WhereNode } from './types.js';
import type { Dialect } from './dialects/dialect.js';
import { PostgresDialect } from './dialects/postgres.js';
import { MySQLDialect } from './dialects/mysql.js';
import { SQLiteDialect } from './dialects/sqlite.js';
import { MSSQLDialect } from './dialects/mssql.js';
import { MongoDialect } from './dialects/mongo.js';

class LRUCache<K, V> {
  private map = new Map<K, V>();
  private order: K[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      const idx = this.order.indexOf(key);
      if (idx > -1) {
        this.order.splice(idx, 1);
        this.order.push(key);
      }
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      const idx = this.order.indexOf(key);
      if (idx > -1) this.order.splice(idx, 1);
    } else if (this.order.length >= this.maxSize) {
      const evicted = this.order.shift();
      if (evicted !== undefined) this.map.delete(evicted);
    }
    this.map.set(key, value);
    this.order.push(key);
  }
}

export class QueryCompiler {
  private dialect: Dialect;
  private cache = new LRUCache<string, CompiledQuery>(1000);

  constructor(dbType: DbType) {
    this.dialect = this.createDialect(dbType);
  }

  getDialect(): Dialect {
    return this.dialect;
  }

  select(
    table: string,
    columns: string[],
    where: WhereNode | null,
    orderBy: OrderItem[],
    limit: number | null,
    offset: number | null,
    distinct?: string[],
  ): CompiledQuery {
    const cacheKey = `SEL:${table}:${columns.join(',')}:${JSON.stringify(where)}:${JSON.stringify(orderBy)}:${limit}:${offset}:${distinct?.join(',')}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const query = this.dialect.compileSelect(table, columns, where, orderBy, limit, offset, distinct);
    this.cache.set(cacheKey, query);
    return query;
  }

  insert(
    table: string,
    data: Record<string, unknown>[],
    returning?: string[],
    skipDuplicates?: boolean,
  ): CompiledQuery {
    return this.dialect.compileInsert(table, data, returning, skipDuplicates);
  }

  update(
    table: string,
    data: Record<string, unknown>,
    where: WhereNode | null,
    returning?: string[],
  ): CompiledQuery {
    const cacheKey = `UPD:${table}:${JSON.stringify(data)}:${JSON.stringify(where)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const query = this.dialect.compileUpdate(table, data, where, returning);
    this.cache.set(cacheKey, query);
    return query;
  }

  delete(
    table: string,
    where: WhereNode | null,
    returning?: string[],
  ): CompiledQuery {
    const cacheKey = `DEL:${table}:${JSON.stringify(where)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const query = this.dialect.compileDelete(table, where, returning);
    this.cache.set(cacheKey, query);
    return query;
  }

  upsert(
    table: string,
    data: Record<string, unknown>,
    conflictKeys: string[],
    updateFields: Record<string, unknown>,
    returning?: string[],
  ): CompiledQuery {
    return this.dialect.compileUpsert(table, data, conflictKeys, updateFields, returning);
  }

  count(
    table: string,
    where: WhereNode | null,
    field?: string,
  ): CompiledQuery {
    const cacheKey = `CNT:${table}:${JSON.stringify(where)}:${field ?? '*'}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const query = this.dialect.compileCount(table, where, field);
    this.cache.set(cacheKey, query);
    return query;
  }

  aggregate(
    table: string,
    where: WhereNode | null,
    aggregations: { fn: string; field: string; alias: string }[],
  ): CompiledQuery {
    const cacheKey = `AGG:${table}:${JSON.stringify(where)}:${JSON.stringify(aggregations)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const query = this.dialect.compileAggregate(table, where, aggregations);
    this.cache.set(cacheKey, query);
    return query;
  }

  groupBy(
    table: string,
    by: string[],
    where: WhereNode | null,
    aggregations: { fn: string; field: string; alias: string }[],
    having: WhereNode | null,
    orderBy: OrderItem[],
    limit: number | null,
    offset: number | null,
  ): CompiledQuery {
    return this.dialect.compileGroupBy(table, by, where, aggregations, having, orderBy, limit, offset);
  }

  resolveColumns(select: SelectClause | undefined, defaultColumns: string[]): string[] {
    if (!select) return defaultColumns;
    return Object.entries(select)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
  }

  isMongo(): boolean {
    return this.dialect.type === 'mongo';
  }

  parseMongoQuery(query: CompiledQuery): MongoQuery {
    return JSON.parse(query.sql) as MongoQuery;
  }

  private createDialect(type: DbType): Dialect {
    switch (type) {
      case 'postgres': return new PostgresDialect();
      case 'mysql': return new MySQLDialect();
      case 'sqlite': return new SQLiteDialect();
      case 'mssql': return new MSSQLDialect();
      case 'mongo': return new MongoDialect();
    }
  }
}
