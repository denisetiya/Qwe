export type {
  DbType, FilterOp, RelationFilter, SortDirection,
  WhereCondition, LogicalNode, RelationNode, WhereNode,
  WhereInput, OrderBy, Select, Include, PaginationOptions,
  OrderItem, SelectClause, IncludeClause,
  FindManyOptions, FindFirstOptions, FindUniqueOptions,
  CreateOptions, CreateManyOptions, UpdateOptions, UpdateManyOptions,
  DeleteOptions, DeleteManyOptions, UpsertOptions,
  AggregateOptions, GroupByOptions, PaginateOptions, PaginateResult,
  TransactionOptions, FieldDefinition, ModelDefinition,
  CompiledQuery, MongoQuery, ConnectionConfig,
  MigrationRecord, MigrationModule, MigrationContext,
  SchemaBuilder, TableBuilder, ColumnBuilder,
} from './types.js';

export type { Dialect } from './dialects/dialect.js';
export { PostgresDialect } from './dialects/postgres.js';
export { MySQLDialect } from './dialects/mysql.js';
export { SQLiteDialect } from './dialects/sqlite.js';
export { MSSQLDialect } from './dialects/mssql.js';
export { MongoDialect } from './dialects/mongo.js';

export { WhereBuilder } from './where-builder.js';
export { IncludeBuilder } from './include-builder.js';
export type { JoinDef, MongoLookupDef } from './include-builder.js';
export { OrderBuilder } from './order-builder.js';
export { QueryCompiler } from './query-compiler.js';
export { BaseModel } from './model.js';
export { Repository } from './repository.js';
export { ConnectionManager } from './connection.js';
export { QweClient, createProxyClient } from './client.js';
export type { TransactionProxy } from './client.js';
export { TransactionManager, TransactionClient } from './transaction.js';
export { Migration } from './migration.js';

import { ConnectionManager } from './connection.js';
import { QweClient, createProxyClient } from './client.js';
import type { ConnectionConfig, ModelDefinition } from './types.js';

export class DatabaseManager {
  private connManager = new ConnectionManager();
  private clients = new Map<string, QweClient>();

  async addConnection(name: string, config: ConnectionConfig): Promise<QweClient> {
    await this.connManager.connect(name, config);
    const client = new QweClient(this.connManager, name);
    this.clients.set(name, client);
    return client;
  }

  getClient(name?: string): QweClient {
    if (name) {
      const client = this.clients.get(name);
      if (!client) throw new Error(`[qwe:orm] Client "${name}" not found`);
      return client;
    }
    const first = this.clients.values().next().value;
    if (!first) throw new Error('[qwe:orm] No database connections configured');
    return first;
  }

  createProxy(name?: string): QweClient & Record<string, import('./model.js').BaseModel> {
    const connectionName = name ?? this.connManager.getDefaultName();
    return createProxyClient(this.connManager, connectionName);
  }

  registerModels(name: string, models: ModelDefinition[]): void {
    const client = this.getClient(name);
    for (const model of models) {
      client.defineModel(model);
    }
  }

  async disconnect(name?: string): Promise<void> {
    await this.connManager.disconnect(name);
  }

  async disconnectAll(): Promise<void> {
    await this.connManager.disconnectAll();
  }
}
