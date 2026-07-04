import { MemoryStore } from './memory.js';
import { buildCacheKey } from './serializer.js';

export interface CacheOptions {
  maxSize?: number;
  ttl?: number;
  prefix?: string;
}

export class CacheManager {
  private store: MemoryStore;
  private prefix: string;

  constructor(options: CacheOptions = {}) {
    this.store = new MemoryStore({
      maxSize: options.maxSize,
      ttl: options.ttl,
    });
    this.prefix = options.prefix ?? 'cache';
  }

  get<T = unknown>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  set(key: string, value: unknown, ttl?: number): void {
    this.store.set(key, value, ttl);
  }

  del(key: string): boolean {
    return this.store.del(key);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }

  mget<T = unknown>(keys: string[]): Map<string, T> {
    const result = this.store.mget(keys);
    return result as Map<string, T>;
  }

  mset(entries: Map<string, unknown>, ttl?: number): void {
    this.store.mset(entries, ttl);
  }

  async wrap<T>(key: string, fn: () => T | Promise<T>, ttl?: number): Promise<T> {
    const cached = this.store.get(key);
    if (cached !== undefined) {
      return cached as T;
    }

    const value = await fn();
    this.store.set(key, value, ttl);
    return value;
  }

  buildKey(methodName: string, args: unknown[]): string {
    return buildCacheKey(this.prefix, methodName, args);
  }

  size(): number {
    return this.store.size();
  }

  keys(): string[] {
    return this.store.keys();
  }

  cleanup(): number {
    return this.store.cleanup();
  }
}
