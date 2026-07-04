import type { Pool } from 'pg';
import type { ConnectionManager } from './connection.js';

export class TransactionManager {
  private connManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connManager = connectionManager;
  }

  async execute<T>(
    callback: (tx: TransactionClient) => Promise<T>,
    options?: { isolationLevel?: string; maxWait?: number; timeout?: number },
    connectionName?: string,
  ): Promise<T> {
    const type = this.connManager.getType(connectionName);

    if (type === 'mongo') {
      return this.executeMongoTransaction(callback, connectionName);
    }
    return this.executeSqlTransaction(callback, options, connectionName);
  }

  private async executeSqlTransaction<T>(
    callback: (tx: TransactionClient) => Promise<T>,
    options?: { isolationLevel?: string; maxWait?: number; timeout?: number },
    connectionName?: string,
  ): Promise<T> {
    const pool = this.connManager.getPool(connectionName);
    const rawPool = pool.raw as Pool;

    const client = await rawPool.connect();
    const type = this.connManager.getType(connectionName);

    try {
      if (options?.isolationLevel) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
      }

      await client.query('BEGIN');

      let savepointCounter = 0;
      const txClient = new TransactionClient(
        async (sql: string, params?: unknown[]) => {
          const result = await client.query(sql, params);
          return { rows: result.rows, rowCount: result.rowCount ?? 0 };
        },
        type,
        async () => {
          savepointCounter++;
          const sp = `sp_${savepointCounter}`;
          await client.query(`SAVEPOINT ${sp}`);
          return sp;
        },
        async (sp: string) => {
          await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
        },
      );

      const result = await callback(txClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async executeMongoTransaction<T>(
    callback: (tx: TransactionClient) => Promise<T>,
    connectionName?: string,
  ): Promise<T> {
    const pool = this.connManager.getPool(connectionName);
    const client = pool.raw as import('mongodb').MongoClient;
    const session = client.startSession();

    try {
      session.startTransaction();

      const type = this.connManager.getType(connectionName);
      const txClient = new TransactionClient(
        async (queryStr: string) => {
          const query = JSON.parse(queryStr) as {
            collection: string;
            operation: string;
            filter?: Record<string, unknown>;
            data?: Record<string, unknown> | Record<string, unknown>[];
            pipeline?: Record<string, unknown>[];
          };

          const db = client.db();
          const collection = db.collection(query.collection);

          switch (query.operation) {
            case 'find':
              return { rows: await collection.find(query.filter ?? {}, { session }).toArray(), rowCount: 0 };
            case 'insertOne': {
              const r = await collection.insertOne(query.data as Record<string, unknown>, { session });
              return { rows: [{ insertedId: r.insertedId }], rowCount: 1 };
            }
            case 'updateMany': {
              const r = await collection.updateMany(query.filter ?? {}, (query.data ?? {}) as Record<string, unknown>, { session });
              return { rows: [{ modifiedCount: r.modifiedCount }], rowCount: r.modifiedCount };
            }
            case 'deleteMany': {
              const r = await collection.deleteMany(query.filter ?? {}, { session });
              return { rows: [{ deletedCount: r.deletedCount }], rowCount: r.deletedCount };
            }
            default: {
              const r = await collection.aggregate(query.pipeline ?? [], { session }).toArray();
              return { rows: r as Record<string, unknown>[], rowCount: r.length };
            }
          }
        },
        type,
      );

      const result = await callback(txClient);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export class TransactionClient {
  private rawQuery: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  private dbType: string;
  private createSavepoint?: () => Promise<string>;
  private rollbackToSavepoint?: (sp: string) => Promise<void>;
  private modelProxies = new Map<string, unknown>();

  constructor(
    rawQuery: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>,
    dbType: string,
    createSavepoint?: () => Promise<string>,
    rollbackToSavepoint?: (sp: string) => Promise<void>,
  ) {
    this.rawQuery = rawQuery;
    this.dbType = dbType;
    this.createSavepoint = createSavepoint;
    this.rollbackToSavepoint = rollbackToSavepoint;
  }

  execute(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
    return this.rawQuery(sql, params);
  }

  getDbType(): string {
    return this.dbType;
  }

  async savepoint(): Promise<string> {
    if (!this.createSavepoint) throw new Error('[qwe:orm] Savepoints not supported for this database type');
    return this.createSavepoint();
  }

  async rollbackTo(sp: string): Promise<void> {
    if (!this.rollbackToSavepoint) throw new Error('[qwe:orm] Savepoints not supported for this database type');
    return this.rollbackToSavepoint(sp);
  }

  registerModel(name: string, model: unknown): void {
    this.modelProxies.set(name, model);
  }

  getModel<T>(name: string): T {
    return this.modelProxies.get(name) as T;
  }
}
