import type { ConnectionManager } from './connection.js';
import type { ModelDefinition, TransactionOptions } from './types.js';
import { BaseModel } from './model.js';
import { QueryCompiler } from './query-compiler.js';
import { TransactionManager, type TransactionClient } from './transaction.js';

export class QweClient {
  private connManager: ConnectionManager;
  private txManager: TransactionManager;
  private models = new Map<string, ModelDefinition>();
  private compiler: QueryCompiler;
  private instances = new Map<string, BaseModel>();
  private connectionName?: string;

  constructor(connManager: ConnectionManager, connectionName?: string) {
    this.connManager = connManager;
    this.txManager = new TransactionManager(connManager);
    const type = connManager.getType(connectionName);
    this.compiler = new QueryCompiler(type);
    this.connectionName = connectionName;
  }

  defineModel(definition: ModelDefinition): this {
    this.models.set(definition.name, definition);
    return this;
  }

  getModel<T = Record<string, unknown>>(name: string): BaseModel<T> {
    const existing = this.instances.get(name);
    if (existing) return existing as BaseModel<T>;

    const def = this.models.get(name);
    if (!def) {
      throw new Error(`[qwe:orm] Model "${name}" not defined. Call defineModel() first.`);
    }

    const model = new BaseModel<T>(def, this.connManager, this.compiler, this.connectionName);
    this.instances.set(name, model as BaseModel);
    return model;
  }

  async transaction<T>(
    callback: (tx: TransactionProxy) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    return this.txManager.execute(
      async (txClient) => {
        const proxy = this.createTransactionProxy(txClient);
        return callback(proxy);
      },
      {
        isolationLevel: options?.isolationLevel,
        maxWait: options?.maxWait,
        timeout: options?.timeout,
      },
      this.connectionName,
    );
  }

  async disconnect(): Promise<void> {
    await this.connManager.disconnect(this.connectionName);
  }

  async disconnectAll(): Promise<void> {
    await this.connManager.disconnectAll();
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `QweClient { models: [${[...this.models.keys()].join(', ')}] }`;
  }

  private createTransactionProxy(txClient: TransactionClient): TransactionProxy {
    const connManager = this.connManager;
    const compiler = this.compiler;
    const models = this.models;
    const connectionName = this.connectionName;

    const cache = new Map<string, BaseModel>();

    return new Proxy({} as TransactionProxy, {
      get(_target, prop) {
        if (prop === 'execute') {
          return (sql: string, params?: unknown[]) => txClient.execute(sql, params);
        }
        if (typeof prop === 'symbol') return undefined;

        if (!cache.has(prop)) {
          const def = models.get(prop);
          if (!def) return undefined;
          const model = new BaseModel(def, connManager, compiler, connectionName, (sql, params) => txClient.execute(sql, params));
          cache.set(prop, model as BaseModel);
        }
        return cache.get(prop);
      },
    });
  }
}

export type TransactionProxy = {
  execute(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
} & {
  [modelName: string]: BaseModel;
};

export function createProxyClient(connManager: ConnectionManager, connectionName?: string): QweClient & Record<string, BaseModel> {
  const client = new QweClient(connManager, connectionName);

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol' || prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      if (typeof prop === 'string') {
        try {
          return target.getModel(prop);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },
  }) as QweClient & Record<string, BaseModel>;
}
