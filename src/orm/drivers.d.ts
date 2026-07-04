declare module 'pg' {
  export class Pool {
    constructor(config: Record<string, unknown>);
    query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
  export class PoolClient {
    query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
    release(): void;
  }
}

declare module 'mysql2/promise' {
  export function createPool(config: Record<string, unknown>): MySqlPool;
  export interface MySqlPool {
    execute(sql: string, params?: unknown[]): Promise<[Record<string, unknown>[] | { affectedRows?: number }, unknown[]]>;
    end(): Promise<void>;
  }
}

declare module 'better-sqlite3' {
  class Database {
    constructor(path: string);
    prepare(sql: string): Statement;
    pragma(pragma: string): void;
    close(): void;
  }
  interface Statement {
    all(...params: unknown[]): Record<string, unknown>[];
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  }
  export = Database;
}

declare module 'tedious' {
  export class Connection {
    constructor(config: Record<string, unknown>);
    connect(): void;
    on(event: 'connect', listener: (err?: Error) => void): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    execSql(request: Request): void;
    close(): void;
  }
  export class Request {
    constructor(sql: string, callback: (err: Error | null, rowCount: number | null) => void);
    addParameter(name: string, type: unknown, value: unknown): void;
    on(event: 'row', listener: (columns: { metadata?: { colName?: string }; value: unknown }[]) => void): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
  }
  export const types: Record<string, unknown>;
}

declare module 'mongodb' {
  export class MongoClient {
    constructor(url: string, options?: Record<string, unknown>);
    connect(): Promise<void>;
    db(name?: string): Db;
    startSession(): ClientSession;
    close(): Promise<void>;
  }
  export interface ClientSession {
    startTransaction(): void;
    commitTransaction(): Promise<void>;
    abortTransaction(): Promise<void>;
    endSession(): void;
  }
  export interface Db {
    collection(name: string): Collection;
  }
  export interface Collection {
    find(filter?: Record<string, unknown>, options?: Record<string, unknown>): { toArray(): Promise<Record<string, unknown>[]> };
    findOne(filter?: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    insertOne(doc: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ insertedId: unknown }>;
    insertMany(docs: Record<string, unknown>[]): Promise<{ insertedCount: number }>;
    updateOne(filter: Record<string, unknown>, update: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ modifiedCount: number }>;
    updateMany(filter: Record<string, unknown>, update: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ modifiedCount: number }>;
    deleteOne(filter: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ deletedCount: number }>;
    deleteMany(filter: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ deletedCount: number }>;
    aggregate(pipeline: Record<string, unknown>[], options?: Record<string, unknown>): { toArray(): Promise<Record<string, unknown>[]> };
  }
}
