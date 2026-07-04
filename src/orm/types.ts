export type DbType = 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'mongo';

export type FilterOp =
  | 'eq' | 'not' | 'in' | 'notIn'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'startsWith' | 'endsWith'
  | 'isNull' | 'isNotNull'
  | 'has' | 'hasEvery' | 'hasSome' | 'isEmpty';

export type RelationFilter = 'some' | 'every' | 'none';

export type SortDirection = 'asc' | 'desc';

export interface WhereCondition {
  field: string;
  op: FilterOp;
  value: unknown;
}

export interface LogicalNode {
  type: 'AND' | 'OR' | 'NOT';
  children: WhereNode[];
}

export interface RelationNode {
  field: string;
  filter: RelationFilter;
  child: WhereNode;
}

export type WhereNode = WhereCondition | LogicalNode | RelationNode;

export type OrderItem = { field: string; direction: SortDirection };

export interface SelectClause {
  [field: string]: boolean | SelectClause;
}

export interface IncludeClause {
  [relation: string]: boolean | {
    select?: SelectClause;
    where?: WhereInput;
    orderBy?: OrderBy;
    take?: number;
    skip?: number;
    include?: IncludeClause;
  };
}

export type WhereInput = {
  [field: string]: unknown;
  AND?: WhereInput | WhereInput[];
  OR?: WhereInput[];
  NOT?: WhereInput | WhereInput[];
};

export type OrderBy = {
  [field: string]: SortDirection | OrderBy;
};

export type Select = SelectClause;

export type Include = IncludeClause;

export interface PaginationOptions {
  take?: number;
  skip?: number;
}

export interface FindManyOptions {
  where?: WhereInput;
  select?: Select;
  include?: Include;
  orderBy?: OrderBy | OrderBy[];
  take?: number;
  skip?: number;
  cursor?: Record<string, unknown>;
  distinct?: string[];
}

export interface FindFirstOptions {
  where?: WhereInput;
  select?: Select;
  include?: Include;
  orderBy?: OrderBy | OrderBy[];
  skip?: number;
}

export interface FindUniqueOptions {
  where: Record<string, unknown>;
  select?: Select;
  include?: Include;
}

export interface CreateOptions {
  data: Record<string, unknown>;
  select?: Select;
  include?: Include;
}

export interface CreateManyOptions {
  data: Record<string, unknown>[];
  skipDuplicates?: boolean;
}

export interface UpdateOptions {
  where: WhereInput;
  data: Record<string, unknown>;
  select?: Select;
  include?: Include;
}

export interface UpdateManyOptions {
  where?: WhereInput;
  data: Record<string, unknown>;
}

export interface DeleteOptions {
  where: WhereInput;
  select?: Select;
}

export interface DeleteManyOptions {
  where?: WhereInput;
}

export interface UpsertOptions {
  where: Record<string, unknown>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
  select?: Select;
  include?: Include;
}

export interface AggregateOptions {
  where?: WhereInput;
  _count?: boolean | { [field: string]: boolean };
  _sum?: { [field: string]: boolean };
  _avg?: { [field: string]: boolean };
  _min?: { [field: string]: boolean };
  _max?: { [field: string]: boolean };
}

export interface GroupByOptions extends AggregateOptions {
  by: string[];
  having?: WhereInput;
  orderBy?: OrderBy | OrderBy[];
  take?: number;
  skip?: number;
}

export interface PaginateOptions extends FindManyOptions {
  page?: number;
  perPage?: number;
}

export interface PaginateResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
}

export interface FieldDefinition {
  type: string;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: unknown;
  relation?: {
    model: string;
    field?: string;
    references?: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  };
}

export interface ModelDefinition {
  name: string;
  tableName: string;
  fields: Record<string, FieldDefinition>;
  indexes?: { fields: string[]; unique?: boolean }[];
}

export interface CompiledQuery {
  sql: string;
  params: unknown[];
  cacheKey: string;
}

export interface MongoQuery {
  collection: string;
  operation: 'find' | 'insertOne' | 'insertMany' | 'updateOne' | 'updateMany' | 'deleteOne' | 'deleteMany' | 'aggregate';
  filter?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  pipeline?: Record<string, unknown>[];
  options?: Record<string, unknown>;
}

export interface ConnectionConfig {
  type: DbType;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  url?: string;
  pool?: {
    min?: number;
    max?: number;
    idleTimeoutMs?: number;
  };
  ssl?: boolean | Record<string, unknown>;
  schema?: string;
  filename?: string;
}

export interface MigrationRecord {
  id: number;
  name: string;
  appliedAt: Date;
  checksum: string;
}

export interface MigrationModule {
  up: (context: MigrationContext) => Promise<void>;
  down: (context: MigrationContext) => Promise<void>;
}

export interface MigrationContext {
  sql: (query: string, params?: unknown[]) => Promise<void>;
  schema: SchemaBuilder;
}

export interface SchemaBuilder {
  createTable(name: string, cb: (table: TableBuilder) => void): Promise<void>;
  dropTable(name: string): Promise<void>;
  alterTable(name: string, cb: (table: TableBuilder) => void): Promise<void>;
  renameTable(from: string, to: string): Promise<void>;
}

export interface TableBuilder {
  id(name?: string): void;
  string(name: string, length?: number): ColumnBuilder;
  text(name: string): ColumnBuilder;
  integer(name: string): ColumnBuilder;
  bigInt(name: string): ColumnBuilder;
  float(name: string): ColumnBuilder;
  decimal(name: string, precision?: number, scale?: number): ColumnBuilder;
  boolean(name: string): ColumnBuilder;
  date(name: string): ColumnBuilder;
  dateTime(name: string): ColumnBuilder;
  timestamp(name: string): ColumnBuilder;
  json(name: string): ColumnBuilder;
  binary(name: string): ColumnBuilder;
  enum(name: string, values: string[]): ColumnBuilder;
  uuid(name: string): ColumnBuilder;
  index(fields: string[], options?: { unique?: boolean }): void;
  dropColumn(name: string): void;
  renameColumn(from: string, to: string): void;
}

export interface ColumnBuilder {
  primaryKey(): ColumnBuilder;
  autoIncrement(): ColumnBuilder;
  unique(): ColumnBuilder;
  nullable(): ColumnBuilder;
  notNull(): ColumnBuilder;
  default(value: unknown): ColumnBuilder;
  references(table: string, column: string): ColumnBuilder;
  onDelete(action: string): ColumnBuilder;
  onUpdate(action: string): ColumnBuilder;
}
