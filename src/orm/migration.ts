import type { ConnectionManager } from './connection.js';
import type { MigrationModule, MigrationRecord, MigrationContext, TableBuilder, ColumnBuilder, SchemaBuilder } from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const MIGRATIONS_TABLE = '_migrations';

export class Migration {
  private connManager: ConnectionManager;
  private migrationsDir: string;
  private connectionName?: string;

  constructor(connManager: ConnectionManager, migrationsDir?: string, connectionName?: string) {
    this.connManager = connManager;
    this.migrationsDir = migrationsDir ?? './migrations';
    this.connectionName = connectionName;
  }

  async createMigration(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const filename = `${timestamp}_${this.sanitizeName(name)}.ts`;
    const filePath = path.resolve(this.migrationsDir, filename);

    const dirPath = path.resolve(this.migrationsDir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const template = `import type { MigrationModule } from 'qwe';

export const migration: MigrationModule = {
  async up(ctx) {
    // Migration UP logic
  },

  async down(ctx) {
    // Migration DOWN logic
  },
};
`;

    fs.writeFileSync(filePath, template, 'utf-8');
    return filePath;
  }

  async runMigrations(): Promise<{ applied: string[] }> {
    await this.ensureMigrationsTable();
    const applied = await this.getAppliedMigrations();
    const appliedNames = new Set(applied.map((m) => m.name));
    const files = this.getMigrationFiles();
    const appliedList: string[] = [];

    for (const file of files) {
      const name = path.basename(file);
      if (appliedNames.has(name)) continue;

      const mod = await this.loadMigration(file);
      if (!mod) continue;

      const ctx = this.createContext();
      await mod.up(ctx);

      const checksum = this.computeChecksum(file);
      await this.recordMigration(name, checksum);
      appliedList.push(name);
    }

    return { applied: appliedList };
  }

  async revertMigration(): Promise<{ reverted: string | null }> {
    await this.ensureMigrationsTable();
    const applied = await this.getAppliedMigrations();
    if (applied.length === 0) return { reverted: null };

    const last = applied[applied.length - 1]!;
    const file = this.getMigrationFiles().find((f) => path.basename(f) === last.name);
    if (!file) throw new Error(`[qwe:orm] Migration file for "${last.name}" not found`);

    const mod = await this.loadMigration(file);
    if (!mod) throw new Error(`[qwe:orm] Failed to load migration "${last.name}"`);

    const ctx = this.createContext();
    await mod.down(ctx);
    await this.removeMigrationRecord(last.name);

    return { reverted: last.name };
  }

  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const pool = this.connManager.getPool(this.connectionName);
    const result = await pool.query(
      `SELECT id, name, applied_at as "appliedAt", checksum FROM "${MIGRATIONS_TABLE}" ORDER BY id ASC`,
    );
    return result.rows as unknown as MigrationRecord[];
  }

  private async ensureMigrationsTable(): Promise<void> {
    const pool = this.connManager.getPool(this.connectionName);
    const type = this.connManager.getType(this.connectionName);

    let sql: string;
    switch (type) {
      case 'postgres':
        sql = `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP DEFAULT NOW(),
          checksum VARCHAR(64) NOT NULL
        )`;
        break;
      case 'mysql':
        sql = `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          checksum VARCHAR(64) NOT NULL
        )`;
        break;
      case 'sqlite':
        sql = `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          applied_at TEXT DEFAULT (datetime('now')),
          checksum TEXT NOT NULL
        )`;
        break;
      case 'mssql':
        sql = `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='${MIGRATIONS_TABLE}' AND xtype='U')
          CREATE TABLE [${MIGRATIONS_TABLE}] (
            id INT IDENTITY(1,1) PRIMARY KEY,
            name NVARCHAR(255) NOT NULL UNIQUE,
            applied_at DATETIME DEFAULT GETDATE(),
            checksum NVARCHAR(64) NOT NULL
          )`;
        break;
      default:
        throw new Error(`[qwe:orm] Migration not supported for database type: ${type}`);
    }

    await pool.query(sql);
  }

  private async recordMigration(name: string, checksum: string): Promise<void> {
    const pool = this.connManager.getPool(this.connectionName);
    const type = this.connManager.getType(this.connectionName);

    let sql: string;
    switch (type) {
      case 'postgres':
        sql = `INSERT INTO "${MIGRATIONS_TABLE}" (name, checksum) VALUES ($1, $2)`;
        break;
      case 'mysql':
        sql = 'INSERT INTO `' + MIGRATIONS_TABLE + '` (name, checksum) VALUES (?, ?)';
        break;
      case 'sqlite':
        sql = `INSERT INTO "${MIGRATIONS_TABLE}" (name, checksum) VALUES (?, ?)`;
        break;
      case 'mssql':
        sql = `INSERT INTO [${MIGRATIONS_TABLE}] (name, checksum) VALUES (@P1, @P2)`;
        break;
      default:
        sql = `INSERT INTO "${MIGRATIONS_TABLE}" (name, checksum) VALUES (?, ?)`;
    }

    await pool.query(sql, [name, checksum]);
  }

  private async removeMigrationRecord(name: string): Promise<void> {
    const pool = this.connManager.getPool(this.connectionName);
    const type = this.connManager.getType(this.connectionName);

    let sql: string;
    switch (type) {
      case 'postgres':
        sql = `DELETE FROM "${MIGRATIONS_TABLE}" WHERE name = $1`;
        break;
      case 'mysql':
        sql = 'DELETE FROM `' + MIGRATIONS_TABLE + '` WHERE name = ?';
        break;
      case 'sqlite':
        sql = `DELETE FROM "${MIGRATIONS_TABLE}" WHERE name = ?`;
        break;
      case 'mssql':
        sql = `DELETE FROM [${MIGRATIONS_TABLE}] WHERE name = @P1`;
        break;
      default:
        sql = `DELETE FROM "${MIGRATIONS_TABLE}" WHERE name = ?`;
    }

    await pool.query(sql, [name]);
  }

  private getMigrationFiles(): string[] {
    const dirPath = path.resolve(this.migrationsDir);
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
      .sort()
      .map((f) => path.join(dirPath, f));
  }

  private async loadMigration(filePath: string): Promise<MigrationModule | null> {
    try {
      const mod = await import(filePath);
      return mod.migration ?? mod.default ?? mod;
    } catch {
      return null;
    }
  }

  private computeChecksum(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private sanitizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private createContext(): MigrationContext {
    const pool = this.connManager.getPool(this.connectionName);
    const type = this.connManager.getType(this.connectionName);

    return {
      sql: async (query: string, params?: unknown[]) => {
        await pool.query(query, params);
      },
      schema: this.createSchemaBuilder(pool, type),
    };
  }

  private createSchemaBuilder(
    pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }> },
    type: string,
  ): SchemaBuilder {
    return {
      createTable: async (name: string, cb: (table: TableBuilder) => void) => {
        const builder = new TableBuilderImpl(type);
        cb(builder);
        const sql = builder.toCreateSQL(name);
        await pool.query(sql);
      },
      dropTable: async (name: string) => {
        const quote = type === 'mysql' ? '`' : type === 'mssql' ? '' : '"';
        await pool.query(`DROP TABLE IF EXISTS ${quote}${name}${quote}`);
      },
      alterTable: async (name: string, cb: (table: TableBuilder) => void) => {
        const builder = new TableBuilderImpl(type);
        cb(builder);
        const statements = builder.toAlterSQL(name);
        for (const stmt of statements) {
          await pool.query(stmt);
        }
      },
      renameTable: async (from: string, to: string) => {
        await pool.query(`ALTER TABLE "${from}" RENAME TO "${to}"`);
      },
    };
  }
}

class ColumnBuilderImpl implements ColumnBuilder {
  private _name: string;
  private _type: string;
  private _pk = false;
  private _autoInc = false;
  private _unique = false;
  private _nullable = false;
  private _default: unknown = undefined;
  private _refTable?: string;
  private _refColumn?: string;
  private _onDelete?: string;
  private _onUpdate?: string;

  constructor(name: string, type: string) {
    this._name = name;
    this._type = type;
  }

  primaryKey(): ColumnBuilder { this._pk = true; return this; }
  autoIncrement(): ColumnBuilder { this._autoInc = true; return this; }
  unique(): ColumnBuilder { this._unique = true; return this; }
  nullable(): ColumnBuilder { this._nullable = true; return this; }
  notNull(): ColumnBuilder { this._nullable = false; return this; }
  default(value: unknown): ColumnBuilder { this._default = value; return this; }
  references(table: string, column: string): ColumnBuilder {
    this._refTable = table;
    this._refColumn = column;
    return this;
  }
  onDelete(action: string): ColumnBuilder { this._onDelete = action; return this; }
  onUpdate(action: string): ColumnBuilder { this._onUpdate = action; return this; }

  getName(): string { return this._name; }

  toSQL(type: string): string {
    let sql = `"${this._name}" ${this._type}`;
    if (this._pk) sql += ' PRIMARY KEY';
    if (this._autoInc) {
      if (type === 'postgres') sql = `"${this._name}" SERIAL`;
      else if (type === 'mysql') sql = `\`${this._name}\` INT AUTO_INCREMENT`;
      else if (type === 'sqlite') sql = `"${this._name}" INTEGER`;
      if (this._pk) sql += ' PRIMARY KEY';
    }
    if (this._unique && !this._pk) sql += ' UNIQUE';
    if (!this._nullable && !this._pk) sql += ' NOT NULL';
    if (this._default !== undefined) {
      const defStr = typeof this._default === 'string' ? `'${this._default}'` : String(this._default);
      sql += ` DEFAULT ${defStr}`;
    }
    if (this._refTable) {
      sql += ` REFERENCES "${this._refTable}" ("${this._refColumn}")`;
      if (this._onDelete) sql += ` ON DELETE ${this._onDelete}`;
      if (this._onUpdate) sql += ` ON UPDATE ${this._onUpdate}`;
    }
    return sql;
  }
}

class TableBuilderImpl implements TableBuilder {
  private columns: ColumnBuilderImpl[] = [];
  private indexes: { fields: string[]; unique?: boolean }[] = [];
  private drops: string[] = [];
  private renames: { from: string; to: string }[] = [];
  private type: string;

  constructor(type: string) {
    this.type = type;
  }

  id(name = 'id'): void {
    const col = new ColumnBuilderImpl(name, 'INTEGER');
    col.primaryKey().autoIncrement();
    this.columns.push(col);
  }

  string(name: string, length = 255): ColumnBuilder {
    const colType = this.type === 'mysql' ? `VARCHAR(${length})` : 'VARCHAR';
    const col = new ColumnBuilderImpl(name, colType);
    this.columns.push(col);
    return col;
  }

  text(name: string): ColumnBuilder {
    const col = new ColumnBuilderImpl(name, 'TEXT');
    this.columns.push(col);
    return col;
  }

  integer(name: string): ColumnBuilder {
    const col = new ColumnBuilderImpl(name, 'INTEGER');
    this.columns.push(col);
    return col;
  }

  bigInt(name: string): ColumnBuilder {
    const col = new ColumnBuilderImpl(name, 'BIGINT');
    this.columns.push(col);
    return col;
  }

  float(name: string): ColumnBuilder {
    const col = new ColumnBuilderImpl(name, 'REAL');
    this.columns.push(col);
    return col;
  }

  decimal(name: string, precision = 10, scale = 2): ColumnBuilder {
    const col = new ColumnBuilderImpl(name, `DECIMAL(${precision}, ${scale})`);
    this.columns.push(col);
    return col;
  }

  boolean(name: string): ColumnBuilder {
    const colType = this.type === 'mysql' ? 'TINYINT(1)' : 'BOOLEAN';
    const col = new ColumnBuilderImpl(name, colType);
    this.columns.push(col);
    return col;
  }

  date(name: string): ColumnBuilder {
    const col = new ColumnBuilderImpl(name, 'DATE');
    this.columns.push(col);
    return col;
  }

  dateTime(name: string): ColumnBuilder {
    const colType = this.type === 'postgres' ? 'TIMESTAMP' : 'DATETIME';
    const col = new ColumnBuilderImpl(name, colType);
    this.columns.push(col);
    return col;
  }

  timestamp(name: string): ColumnBuilder {
    const col = new ColumnBuilderImpl(name, 'TIMESTAMP');
    this.columns.push(col);
    return col;
  }

  json(name: string): ColumnBuilder {
    const colType = this.type === 'postgres' ? 'JSONB' : 'JSON';
    const col = new ColumnBuilderImpl(name, colType);
    this.columns.push(col);
    return col;
  }

  binary(name: string): ColumnBuilder {
    const col = new ColumnBuilderImpl(name, 'BLOB');
    this.columns.push(col);
    return col;
  }

  enum(name: string, values: string[]): ColumnBuilder {
    const colType = this.type === 'mysql'
      ? `ENUM(${values.map((v) => `'${v}'`).join(', ')})`
      : 'VARCHAR';
    const col = new ColumnBuilderImpl(name, colType);
    this.columns.push(col);
    return col;
  }

  uuid(name: string): ColumnBuilder {
    const col = new ColumnBuilderImpl(name, 'UUID');
    this.columns.push(col);
    return col;
  }

  index(fields: string[], options?: { unique?: boolean }): void {
    this.indexes.push({ fields, unique: options?.unique });
  }

  dropColumn(name: string): void {
    this.drops.push(name);
  }

  renameColumn(from: string, to: string): void {
    this.renames.push({ from, to });
  }

  toCreateSQL(tableName: string): string {
    const colDefs = this.columns.map((c) => c.toSQL(this.type)).join(', ');
    let sql = `CREATE TABLE "${tableName}" (${colDefs})`;
    return sql;
  }

  toAlterSQL(tableName: string): string[] {
    const stmts: string[] = [];
    for (const col of this.columns) {
      stmts.push(`ALTER TABLE "${tableName}" ADD COLUMN ${col.toSQL(this.type)}`);
    }
    for (const drop of this.drops) {
      stmts.push(`ALTER TABLE "${tableName}" DROP COLUMN "${drop}"`);
    }
    for (const rename of this.renames) {
      stmts.push(`ALTER TABLE "${tableName}" RENAME COLUMN "${rename.from}" TO "${rename.to}"`);
    }
    for (const idx of this.indexes) {
      const unique = idx.unique ? 'UNIQUE ' : '';
      const name = `idx_${tableName}_${idx.fields.join('_')}`;
      stmts.push(`CREATE ${unique}INDEX "${name}" ON "${tableName}" (${idx.fields.map((f) => `"${f}"`).join(', ')})`);
    }
    return stmts;
  }
}
