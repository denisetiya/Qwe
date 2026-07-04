import type { ConnectionConfig, DbType } from './types.js';

interface Pool {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  end: () => Promise<void>;
  raw: unknown;
}

interface ConnectionEntry {
  pool: Pool;
  config: ConnectionConfig;
  type: DbType;
}

export class ConnectionManager {
  private connections = new Map<string, ConnectionEntry>();
  private defaultName: string | null = null;

  async connect(name: string, config: ConnectionConfig): Promise<void> {
    if (this.connections.has(name)) {
      throw new Error(`[qwe:orm] Connection "${name}" already exists`);
    }

    const pool = await this.createPool(config);
    this.connections.set(name, { pool, config, type: config.type });

    if (!this.defaultName) {
      this.defaultName = name;
    }
  }

  getPool(name?: string): Pool {
    const key = name ?? this.defaultName;
    if (!key) throw new Error('[qwe:orm] No database connection configured');
    const entry = this.connections.get(key);
    if (!entry) throw new Error(`[qwe:orm] Connection "${key}" not found`);
    return entry.pool;
  }

  getType(name?: string): DbType {
    const key = name ?? this.defaultName;
    if (!key) throw new Error('[qwe:orm] No database connection configured');
    const entry = this.connections.get(key);
    if (!entry) throw new Error(`[qwe:orm] Connection "${key}" not found`);
    return entry.type;
  }

  getDefaultName(): string {
    if (!this.defaultName) throw new Error('[qwe:orm] No database connection configured');
    return this.defaultName;
  }

  getConnectionNames(): string[] {
    return [...this.connections.keys()];
  }

  async disconnect(name?: string): Promise<void> {
    const key = name ?? this.defaultName;
    if (!key) return;
    const entry = this.connections.get(key);
    if (entry) {
      await entry.pool.end();
      this.connections.delete(key);
      if (this.defaultName === key) {
        this.defaultName = this.connections.size > 0 ? this.connections.keys().next().value ?? null : null;
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [name] of this.connections) {
      await this.disconnect(name);
    }
  }

  private async createPool(config: ConnectionConfig): Promise<Pool> {
    switch (config.type) {
      case 'postgres': return this.createPostgresPool(config);
      case 'mysql': return this.createMySQLPool(config);
      case 'sqlite': return this.createSQLitePool(config);
      case 'mssql': return this.createMSSQLPool(config);
      case 'mongo': return this.createMongoPool(config);
    }
  }

  private async createPostgresPool(config: ConnectionConfig): Promise<Pool> {
    const pg = await import('pg');
    const PgPool = pg.default?.Pool ?? pg.Pool;
    const pool = new PgPool({
      host: config.host ?? 'localhost',
      port: config.port ?? 5432,
      user: config.user,
      password: config.password,
      database: config.database,
      max: config.pool?.max ?? 10,
      idleTimeoutMillis: config.pool?.idleTimeoutMs ?? 30000,
      ssl: config.ssl as Record<string, unknown> | undefined,
    });

    return {
      query: async (sql: string, params?: unknown[]) => {
        const result = await pool.query(sql, params);
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
      },
      end: async () => { await pool.end(); },
      raw: pool,
    };
  }

  private async createMySQLPool(config: ConnectionConfig): Promise<Pool> {
    const mysql2 = await import('mysql2/promise');
    const mysql = mysql2.default ?? mysql2;
    const pool = mysql.createPool({
      host: config.host ?? 'localhost',
      port: config.port ?? 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: config.pool?.max ?? 10,
      idleTimeout: config.pool?.idleTimeoutMs ?? 30000,
    });

    return {
      query: async (sql: string, params?: unknown[]) => {
        const [rows] = await pool.execute(sql, params);
        return {
          rows: rows as Record<string, unknown>[],
          rowCount: Array.isArray(rows) ? rows.length : ((rows as { affectedRows?: number }).affectedRows ?? 0),
        };
      },
      end: async () => { await pool.end(); },
      raw: pool,
    };
  }

  private async createSQLitePool(config: ConnectionConfig): Promise<Pool> {
    const sqlite = await import('better-sqlite3');
    const Database = sqlite.default ?? sqlite;
    const dbPath = config.filename ?? config.database;
    const db = new Database(dbPath);

    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');

    // Optimize: Cache prepared statements (max 100 statements)
    const statementCache = new Map<string, any>();
    const CACHE_SIZE = 100;

    const getStatement = (sql: string) => {
      let stmt = statementCache.get(sql);
      if (!stmt) {
        // Evict oldest entry if cache is full
        if (statementCache.size >= CACHE_SIZE) {
          const firstKey = statementCache.keys().next().value;
          if (firstKey !== undefined) {
            statementCache.delete(firstKey);
          }
        }
        stmt = db.prepare(sql);
        statementCache.set(sql, stmt);
      }
      return stmt;
    };

    return {
      query: async (sql: string, params?: unknown[]) => {
        const trimmed = sql.trimStart().toUpperCase();
        const stmt = getStatement(sql);
        
        if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
          const rows = stmt.all(...(params ?? [])) as Record<string, unknown>[];
          return { rows, rowCount: rows.length };
        }
        const info = stmt.run(...(params ?? []));
        return { rows: [], rowCount: info.changes };
      },
      end: async () => { 
        statementCache.clear();
        db.close(); 
      },
      raw: db,
    };
  }

  private async createMSSQLPool(config: ConnectionConfig): Promise<Pool> {
    const tedious = await import('tedious');
    const { Connection: TediousConnection, Request } = tedious;

    const connectionConfig = {
      server: config.host ?? 'localhost',
      options: {
        port: config.port ?? 1433,
        database: config.database,
        encrypt: config.ssl !== false,
        trustServerCertificate: true,
      },
      authentication: {
        type: 'default',
        options: {
          userName: config.user ?? '',
          password: config.password ?? '',
        },
      },
    };

    const conn = new TediousConnection(connectionConfig);
    await new Promise<void>((resolve, reject) => {
      conn.on('connect', (err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
      conn.connect();
    });

    return {
      query: async (sql: string, params?: unknown[]) => {
        return new Promise((resolve, reject) => {
          const rows: Record<string, unknown>[] = [];
          const request = new Request(sql, (err: Error | null, rowCount: number | null) => {
            if (err) reject(err);
            else resolve({ rows, rowCount: rowCount ?? 0 });
          });
          if (params) {
            params.forEach((param, i) => {
              const type = this.getMSSQLType(param);
              request.addParameter(`P${i + 1}`, type, param);
            });
          }
          request.on('row', (columns) => {
            const row: Record<string, unknown> = {};
            columns.forEach((col) => {
              row[col.metadata?.colName ?? ''] = col.value;
            });
            rows.push(row);
          });
          conn.execSql(request);
        });
      },
      end: async () => { conn.close(); },
      raw: conn,
    };
  }

  private async createMongoPool(config: ConnectionConfig): Promise<Pool> {
    const mongodb = await import('mongodb');
    const { MongoClient } = mongodb;

    const url = config.url ?? `mongodb://${config.host ?? 'localhost'}:${config.port ?? 27017}/${config.database}`;
    const client = new MongoClient(url);
    await client.connect();
    const db = client.db(config.database);

    return {
      query: async (queryStr: string) => {
        const query = JSON.parse(queryStr) as {
          collection: string;
          operation: string;
          filter?: Record<string, unknown>;
          data?: Record<string, unknown> | Record<string, unknown>[];
          pipeline?: Record<string, unknown>[];
          options?: Record<string, unknown>;
        };

        const collection = db.collection(query.collection);

        switch (query.operation) {
          case 'find': {
            const cursor = collection.find(query.filter ?? {});
            const rows = await cursor.toArray() as Record<string, unknown>[];
            return { rows, rowCount: rows.length };
          }
          case 'insertOne': {
            const result = await collection.insertOne(query.data as Record<string, unknown>);
            return { rows: [{ insertedId: result.insertedId }], rowCount: 1 };
          }
          case 'insertMany': {
            const result = await collection.insertMany(query.data as Record<string, unknown>[]);
            return { rows: [{ insertedCount: result.insertedCount }], rowCount: result.insertedCount };
          }
          case 'updateOne': {
            const result = await collection.updateOne(
              query.filter ?? {},
              (query.data ?? {}) as Record<string, unknown>,
              (query.options ?? {}) as Record<string, unknown>,
            );
            return { rows: [{ modifiedCount: result.modifiedCount }], rowCount: result.modifiedCount };
          }
          case 'updateMany': {
            const result = await collection.updateMany(query.filter ?? {}, (query.data ?? {}) as Record<string, unknown>);
            return { rows: [{ modifiedCount: result.modifiedCount }], rowCount: result.modifiedCount };
          }
          case 'deleteOne': {
            const result = await collection.deleteOne(query.filter ?? {});
            return { rows: [{ deletedCount: result.deletedCount }], rowCount: result.deletedCount };
          }
          case 'deleteMany': {
            const result = await collection.deleteMany(query.filter ?? {});
            return { rows: [{ deletedCount: result.deletedCount }], rowCount: result.deletedCount };
          }
          case 'aggregate': {
            const result = await collection.aggregate(query.pipeline ?? []).toArray();
            return { rows: result as Record<string, unknown>[], rowCount: result.length };
          }
          default:
            throw new Error(`[qwe:orm] Unknown MongoDB operation: ${query.operation}`);
        }
      },
      end: async () => { await client.close(); },
      raw: client,
    };
  }

  private getMSSQLType(value: unknown): unknown {
    const tedious = require('tedious');
    if (typeof value === 'number') {
      return Number.isInteger(value) ? tedious.types.Int : tedious.types.Float;
    }
    if (typeof value === 'string') return tedious.types.NVarChar;
    if (typeof value === 'boolean') return tedious.types.Bit;
    if (value instanceof Date) return tedious.types.DateTime;
    return tedious.types.NVarChar;
  }
}
