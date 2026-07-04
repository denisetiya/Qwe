import { loadEnv } from './env.loader';

export class Config {
  private values = new Map<string, string>();

  constructor(envFile?: string, dir?: string) {
    const loaded = loadEnv(envFile, dir);
    Object.entries(loaded).forEach(([k, v]) => this.values.set(k, v));
    Object.entries(process.env).forEach(([k, v]) => {
      if (v !== undefined && !this.values.has(k)) this.values.set(k, v);
    });
  }

  get(key: string, fallback?: string): string | undefined {
    return this.values.get(key) ?? fallback;
  }

  require(key: string): string {
    const val = this.values.get(key);
    if (val === undefined) throw new Error(`Missing required config: ${key}`);
    return val;
  }

  int(key: string, fallback?: number): number | undefined {
    const val = this.values.get(key);
    if (val === undefined) return fallback;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  bool(key: string, fallback = false): boolean {
    const val = this.values.get(key);
    if (val === undefined) return fallback;
    return /^(true|1|yes)$/i.test(val);
  }

  set(key: string, value: string): void {
    process.env[key] = value;
    this.values.set(key, value);
  }

  all(): Record<string, string> {
    return Object.fromEntries(this.values);
  }

  keys(): string[] {
    return Array.from(this.values.keys());
  }
}
