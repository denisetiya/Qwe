import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type EnvValue = string | number | boolean | string[] | undefined;

export interface EnvSchema {
  key: string;
  type?: 'string' | 'number' | 'boolean' | 'array';
  default?: EnvValue;
  required?: boolean;
  separator?: string;
}

export interface EnvParseOptions {
  path?: string;
  encoding?: BufferEncoding;
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) return null;

  const key = trimmed.slice(0, eqIdx).trim();
  let value = trimmed.slice(eqIdx + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function parseEnvFile(content: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseEnvLine(lines[i]!);
    if (parsed) {
      result.set(parsed[0], parsed[1]);
    }
  }
  return result;
}

export function loadEnvFile(options: EnvParseOptions = {}): Map<string, string> {
  const filePath = resolve(options.path ?? process.cwd(), '.env');
  if (!existsSync(filePath)) {
    return new Map();
  }
  const content = readFileSync(filePath, options.encoding ?? 'utf8');
  return parseEnvFile(content);
}

function coerceString(value: string): string {
  return value;
}

function coerceNumber(value: string): number {
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`Cannot coerce "${value}" to number`);
  }
  return num;
}

function coerceBoolean(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  throw new Error(`Cannot coerce "${value}" to boolean`);
}

function coerceArray(value: string, separator: string): string[] {
  return value.split(separator).map((s) => s.trim()).filter(Boolean);
}

export class EnvParser {
  private _data = new Map<string, string>();
  private _schema: EnvSchema[] = [];

  load(options: EnvParseOptions = {}): this {
    const fileData = loadEnvFile(options);
    for (const [key, value] of fileData) {
      if (!this._data.has(key)) {
        this._data.set(key, value);
      }
    }
    return this;
  }

  schema(entries: EnvSchema[]): this {
    this._schema = entries;
    return this;
  }

  get(key: string, defaultValue?: string): string | undefined {
    const processVal = process.env[key];
    if (processVal !== undefined) return processVal;

    const fileVal = this._data.get(key);
    if (fileVal !== undefined) return fileVal;

    return defaultValue;
  }

  getTyped(schema: EnvSchema): EnvValue {
    const raw = this.get(schema.key);
    const type = schema.type ?? 'string';
    const separator = schema.separator ?? ',';

    if (raw === undefined) {
      if (schema.default !== undefined) return schema.default;
      if (schema.required) {
        throw new Error(`[qwe:env] Required env variable "${schema.key}" is missing`);
      }
      return undefined;
    }

    switch (type) {
      case 'number':
        return coerceNumber(raw);
      case 'boolean':
        return coerceBoolean(raw);
      case 'array':
        return coerceArray(raw, separator);
      case 'string':
      default:
        return coerceString(raw);
    }
  }

  validate(): void {
    for (const entry of this._schema) {
      if (entry.required && this.get(entry.key) === undefined && entry.default === undefined) {
        throw new Error(`[qwe:env] Required env variable "${entry.key}" is missing`);
      }
    }
  }

  resolveAll(): Map<string, EnvValue> {
    const result = new Map<string, EnvValue>();
    for (const entry of this._schema) {
      result.set(entry.key, this.getTyped(entry));
    }
    return result;
  }
}
