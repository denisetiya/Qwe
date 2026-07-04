export interface CacheEntry {
  value: unknown;
  expiresAt: number;
  ttl: number;
}

export interface MemoryStoreOptions {
  maxSize?: number;
  ttl?: number;
}

export class MemoryStore {
  private data = new Map<string, CacheEntry>();
  private maxSize: number;
  private defaultTtl: number;

  constructor(options: MemoryStoreOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTtl = options.ttl ?? 60000;
  }

  get(key: string): unknown | undefined {
    const entry = this.data.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return undefined;
    }

    this.data.delete(key);
    this.data.set(key, entry);
    return entry.value;
  }

  set(key: string, value: unknown, ttl?: number): void {
    if (this.data.size >= this.maxSize && !this.data.has(key)) {
      const firstKey = this.data.keys().next().value;
      if (firstKey !== undefined) {
        this.data.delete(firstKey);
      }
    }

    const actualTtl = ttl ?? this.defaultTtl;
    const expiresAt = actualTtl > 0 ? Date.now() + actualTtl : 0;

    this.data.delete(key);
    this.data.set(key, { value, expiresAt, ttl: actualTtl });
  }

  del(key: string): boolean {
    return this.data.delete(key);
  }

  has(key: string): boolean {
    const entry = this.data.get(key);
    if (!entry) return false;

    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.data.clear();
  }

  mget(keys: string[]): Map<string, unknown> {
    const result = new Map<string, unknown>();
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      const value = this.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }
    return result;
  }

  mset(entries: Map<string, unknown>, ttl?: number): void {
    for (const [key, value] of entries) {
      this.set(key, value, ttl);
    }
  }

  size(): number {
    return this.data.size;
  }

  keys(): string[] {
    return Array.from(this.data.keys());
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.data) {
      if (entry.expiresAt > 0 && now > entry.expiresAt) {
        this.data.delete(key);
        removed++;
      }
    }
    return removed;
  }
}
