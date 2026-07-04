import type { ConnectionManager } from './connection.js';
import type { QueryCompiler } from './query-compiler.js';
import type {
  AggregateOptions, CreateManyOptions, CreateOptions, DeleteManyOptions,
  DeleteOptions, FindFirstOptions, FindManyOptions,
  FindUniqueOptions, GroupByOptions, ModelDefinition,
  PaginateOptions, PaginateResult, UpdateManyOptions,
  UpdateOptions, UpsertOptions, WhereInput,
} from './types.js';
import { WhereBuilder } from './where-builder.js';
import { OrderBuilder } from './order-builder.js';

type MongoQueryParam = { collection: string; operation: string } & Record<string, unknown>;

export class BaseModel<T = Record<string, unknown>> {
  private definition: ModelDefinition;
  private connManager: ConnectionManager;
  private compiler: QueryCompiler;
  private whereBuilder = new WhereBuilder();
  private orderBuilder = new OrderBuilder();
  private connectionName?: string;
  private rawQueryFn?: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

  constructor(
    definition: ModelDefinition,
    connManager: ConnectionManager,
    compiler: QueryCompiler,
    connectionName?: string,
    rawQueryFn?: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>,
  ) {
    this.definition = definition;
    this.connManager = connManager;
    this.compiler = compiler;
    this.connectionName = connectionName;
    this.rawQueryFn = rawQueryFn;
  }

  async findFirst(options?: FindFirstOptions): Promise<T | null> {
    const where = this.whereBuilder.parse(options?.where);
    const orderBy = this.orderBuilder.parse(options?.orderBy);
    const columns = this.compiler.resolveColumns(options?.select, ['*']);

    if (this.compiler.isMongo()) {
      const query = this.compiler.select(this.definition.tableName, columns, where, orderBy, 1, options?.skip ?? null);
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      const result = await this.executeMongoQuery(mongoQuery);
      return (result.rows[0] as T) ?? null;
    }

    const query = this.compiler.select(this.definition.tableName, columns, where, orderBy, 1, options?.skip ?? null);
    const result = await this.executeQuery(query.sql, query.params);
    return (result.rows[0] as T) ?? null;
  }

  async findUnique(options: FindUniqueOptions): Promise<T | null> {
    return this.findFirst({ where: options.where, select: options.select, include: options.include });
  }

  async findMany(options?: FindManyOptions): Promise<T[]> {
    const where = this.whereBuilder.parse(options?.where);
    const orderBy = this.orderBuilder.parse(options?.orderBy);
    const columns = this.compiler.resolveColumns(options?.select, ['*']);
    const limit = options?.take ?? null;
    const offset = options?.skip ?? null;

    if (this.compiler.isMongo()) {
      const query = this.compiler.select(this.definition.tableName, columns, where, orderBy, limit, offset);
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      const result = await this.executeMongoQuery(mongoQuery);
      return result.rows as T[];
    }

    const query = this.compiler.select(this.definition.tableName, columns, where, orderBy, limit, offset, options?.distinct);
    const result = await this.executeQuery(query.sql, query.params);
    return result.rows as T[];
  }

  async count(options?: { where?: WhereInput; field?: string }): Promise<number> {
    const where = this.whereBuilder.parse(options?.where);

    if (this.compiler.isMongo()) {
      const query = this.compiler.count(this.definition.tableName, where, options?.field);
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      const result = await this.executeMongoQuery(mongoQuery);
      return (result.rows[0] as { count: number })?.count ?? 0;
    }

    const query = this.compiler.count(this.definition.tableName, where, options?.field);
    const result = await this.executeQuery(query.sql, query.params);
    return Number((result.rows[0] as { count: number })?.count ?? 0);
  }

  async create(options: CreateOptions): Promise<T> {
    if (this.compiler.isMongo()) {
      const query = this.compiler.insert(this.definition.tableName, [options.data]);
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      const result = await this.executeMongoQuery(mongoQuery);
      const insertedId = (result.rows[0] as { insertedId: unknown })?.insertedId;
      if (insertedId) {
        return this.findUnique({ where: { _id: insertedId } }) as Promise<T>;
      }
      return { ...options.data, _id: insertedId } as T;
    }

    const returning = this.compiler.getDialect().supportsReturning() ? ['*'] : undefined;
    const query = this.compiler.insert(this.definition.tableName, [options.data], returning);
    const result = await this.executeQuery(query.sql, query.params);

    if (returning && result.rows.length > 0) {
      return result.rows[0] as T;
    }

    const pk = this.getPrimaryKey();
    return this.findFirst({ where: { [pk]: result.rowCount > 0 ? (result.rows[0] as Record<string, unknown>)?.[pk] : undefined } }) as Promise<T>;
  }

  async createMany(options: CreateManyOptions): Promise<{ count: number }> {
    if (options.data.length === 0) return { count: 0 };

    if (this.compiler.isMongo()) {
      const query = this.compiler.insert(this.definition.tableName, options.data);
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      const result = await this.executeMongoQuery(mongoQuery);
      return { count: (result.rows[0] as { insertedCount: number })?.insertedCount ?? options.data.length };
    }

    const query = this.compiler.insert(this.definition.tableName, options.data, undefined, options.skipDuplicates);
    const result = await this.executeQuery(query.sql, query.params);
    return { count: result.rowCount };
  }

  async update(options: UpdateOptions): Promise<T> {
    const where = this.whereBuilder.parse(options.where);

    if (this.compiler.isMongo()) {
      const query = this.compiler.update(this.definition.tableName, options.data, where);
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      await this.executeMongoQuery(mongoQuery);
      const filter = this.whereBuilder.parse(options.where);
      const selectQuery = this.compiler.select(this.definition.tableName, ['*'], filter, [], 1, null);
      const selectResult = await this.executeMongoQuery(this.compiler.parseMongoQuery(selectQuery) as unknown as MongoQueryParam);
      return (selectResult.rows[0] as T) ?? ({} as T);
    }

    const returning = this.compiler.getDialect().supportsReturning() ? ['*'] : undefined;
    const query = this.compiler.update(this.definition.tableName, options.data, where, returning);
    const result = await this.executeQuery(query.sql, query.params);

    if (returning && result.rows.length > 0) {
      return result.rows[0] as T;
    }

    return this.findFirst({ where: options.where }) as Promise<T>;
  }

  async updateMany(options: UpdateManyOptions): Promise<{ count: number }> {
    const where = this.whereBuilder.parse(options.where);

    if (this.compiler.isMongo()) {
      const query = this.compiler.update(this.definition.tableName, options.data, where);
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      const result = await this.executeMongoQuery(mongoQuery);
      return { count: (result.rows[0] as { modifiedCount: number })?.modifiedCount ?? 0 };
    }

    const query = this.compiler.update(this.definition.tableName, options.data, where);
    const result = await this.executeQuery(query.sql, query.params);
    return { count: result.rowCount };
  }

  async delete(options: DeleteOptions): Promise<T> {
    const where = this.whereBuilder.parse(options.where);

    if (this.compiler.isMongo()) {
      const existing = await this.findFirst({ where: options.where });
      const query = this.compiler.delete(this.definition.tableName, where);
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      await this.executeMongoQuery(mongoQuery);
      return (existing ?? {}) as T;
    }

    const returning = this.compiler.getDialect().supportsReturning() ? ['*'] : undefined;
    const query = this.compiler.delete(this.definition.tableName, where, returning);
    const result = await this.executeQuery(query.sql, query.params);

    if (returning && result.rows.length > 0) {
      return result.rows[0] as T;
    }

    return {} as T;
  }

  async deleteMany(options?: DeleteManyOptions): Promise<{ count: number }> {
    const where = this.whereBuilder.parse(options?.where);

    if (this.compiler.isMongo()) {
      const query = this.compiler.delete(this.definition.tableName, where);
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      const result = await this.executeMongoQuery(mongoQuery);
      return { count: (result.rows[0] as { deletedCount: number })?.deletedCount ?? 0 };
    }

    const query = this.compiler.delete(this.definition.tableName, where);
    const result = await this.executeQuery(query.sql, query.params);
    return { count: result.rowCount };
  }

  async upsert(options: UpsertOptions): Promise<T> {
    if (this.compiler.isMongo()) {
      const query = this.compiler.upsert(
        this.definition.tableName,
        options.create,
        Object.keys(options.where),
        options.update,
      );
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      await this.executeMongoQuery(mongoQuery);
      return this.findUnique({ where: options.where }) as Promise<T>;
    }

    const returning = this.compiler.getDialect().supportsReturning() ? ['*'] : undefined;
    const query = this.compiler.upsert(
      this.definition.tableName,
      options.create,
      Object.keys(options.where),
      options.update,
      returning,
    );
    const result = await this.executeQuery(query.sql, query.params);

    if (returning && result.rows.length > 0) {
      return result.rows[0] as T;
    }

    return this.findUnique({ where: options.where }) as Promise<T>;
  }

  async aggregate(options: AggregateOptions): Promise<Record<string, unknown>> {
    const where = this.whereBuilder.parse(options.where);
    const aggregations: { fn: string; field: string; alias: string }[] = [];

    if (options._count === true) {
      aggregations.push({ fn: 'COUNT', field: '*', alias: '_count' });
    } else if (options._count) {
      for (const [field, enabled] of Object.entries(options._count)) {
        if (enabled) aggregations.push({ fn: 'COUNT', field, alias: `_count_${field}` });
      }
    }

    if (options._sum) {
      for (const [field, enabled] of Object.entries(options._sum)) {
        if (enabled) aggregations.push({ fn: 'SUM', field, alias: `_sum_${field}` });
      }
    }
    if (options._avg) {
      for (const [field, enabled] of Object.entries(options._avg)) {
        if (enabled) aggregations.push({ fn: 'AVG', field, alias: `_avg_${field}` });
      }
    }
    if (options._min) {
      for (const [field, enabled] of Object.entries(options._min)) {
        if (enabled) aggregations.push({ fn: 'MIN', field, alias: `_min_${field}` });
      }
    }
    if (options._max) {
      for (const [field, enabled] of Object.entries(options._max)) {
        if (enabled) aggregations.push({ fn: 'MAX', field, alias: `_max_${field}` });
      }
    }

    if (aggregations.length === 0) {
      return {};
    }

    if (this.compiler.isMongo()) {
      const query = this.compiler.aggregate(this.definition.tableName, where, aggregations);
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      const result = await this.executeMongoQuery(mongoQuery);
      return (result.rows[0] as Record<string, unknown>) ?? {};
    }

    const query = this.compiler.aggregate(this.definition.tableName, where, aggregations);
    const result = await this.executeQuery(query.sql, query.params);
    return (result.rows[0] as Record<string, unknown>) ?? {};
  }

  async groupBy(options: GroupByOptions): Promise<Record<string, unknown>[]> {
    const where = this.whereBuilder.parse(options.where);
    const having = this.whereBuilder.parse(options.having);
    const orderBy = this.orderBuilder.parse(options.orderBy);
    const aggregations: { fn: string; field: string; alias: string }[] = [];

    if (options._count === true) {
      aggregations.push({ fn: 'COUNT', field: '*', alias: '_count' });
    } else if (options._count) {
      for (const [field, enabled] of Object.entries(options._count)) {
        if (enabled) aggregations.push({ fn: 'COUNT', field, alias: `_count_${field}` });
      }
    }

    if (options._sum) {
      for (const [field, enabled] of Object.entries(options._sum)) {
        if (enabled) aggregations.push({ fn: 'SUM', field, alias: `_sum_${field}` });
      }
    }
    if (options._avg) {
      for (const [field, enabled] of Object.entries(options._avg)) {
        if (enabled) aggregations.push({ fn: 'AVG', field, alias: `_avg_${field}` });
      }
    }
    if (options._min) {
      for (const [field, enabled] of Object.entries(options._min)) {
        if (enabled) aggregations.push({ fn: 'MIN', field, alias: `_min_${field}` });
      }
    }
    if (options._max) {
      for (const [field, enabled] of Object.entries(options._max)) {
        if (enabled) aggregations.push({ fn: 'MAX', field, alias: `_max_${field}` });
      }
    }

    const query = this.compiler.groupBy(
      this.definition.tableName,
      options.by,
      where,
      aggregations,
      having,
      orderBy,
      options.take ?? null,
      options.skip ?? null,
    );

    if (this.compiler.isMongo()) {
      const mongoQuery = this.compiler.parseMongoQuery(query) as unknown as MongoQueryParam;
      const result = await this.executeMongoQuery(mongoQuery);
      return result.rows as Record<string, unknown>[];
    }

    const result = await this.executeQuery(query.sql, query.params);
    return result.rows as Record<string, unknown>[];
  }

  async paginate(options: PaginateOptions): Promise<PaginateResult<T>> {
    const page = options.page ?? 1;
    const perPage = options.perPage ?? options.take ?? 20;
    const skip = options.skip ?? ((page - 1) * perPage);

    const [data, total] = await Promise.all([
      this.findMany({
        ...options,
        take: perPage,
        skip,
      }),
      this.count({ where: options.where }),
    ]);

    return {
      data,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  private getPrimaryKey(): string {
    for (const [name, field] of Object.entries(this.definition.fields)) {
      if (field.primaryKey) return name;
    }
    return 'id';
  }

  private async executeQuery(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
    if (this.rawQueryFn) {
      return this.rawQueryFn(sql, params);
    }
    const pool = this.connManager.getPool(this.connectionName);
    return pool.query(sql, params);
  }

  private async executeMongoQuery(query: MongoQueryParam): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
    if (this.rawQueryFn) {
      return this.rawQueryFn(JSON.stringify(query), []);
    }
    const pool = this.connManager.getPool(this.connectionName);
    return pool.query(JSON.stringify(query), []);
  }
}
