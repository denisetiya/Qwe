import type { Schema } from '../validation/types.js';
import { Config } from './config.js';

export interface SchemaValidationError {
  key: string;
  message: string;
}

export class ConfigSchemaValidator {
  private _config: Config;

  constructor(cfg: Config) {
    this._config = cfg;
  }

  validate<T>(schema: Schema<T>): { ok: true; value: T } | { ok: false; errors: SchemaValidationError[] } {
    const configData: Record<string, unknown> = {};
    const allData = this._config.all();

    for (const [key, value] of Object.entries(allData)) {
      const parts = key.split('.');
      let current = configData;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;
        if (current[part] === undefined || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]!] = value;
    }

    const result = schema._validate(configData, []);

    if (result.ok) {
      return { ok: true, value: result.value };
    }

    const errors: SchemaValidationError[] = result.errors.map((err) => ({
      key: err.path.join('.'),
      message: err.message,
    }));

    return { ok: false, errors };
  }

  validateOrThrow<T>(schema: Schema<T>): T {
    const result = this.validate(schema);
    if (!result.ok) {
      const messages = result.errors.map((e) => `${e.key}: ${e.message}`).join(', ');
      throw new Error(`[qwe:config] Validation failed: ${messages}`);
    }
    return result.value;
  }
}
