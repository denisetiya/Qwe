type TransformFn<T> = (value: T) => unknown;
type FieldCondition<T> = (value: T) => boolean;

interface FieldConfig<T> {
  include: boolean;
  rename?: string;
  transform?: TransformFn<T>;
  condition?: FieldCondition<T>;
}

export class EntitySerializer<T extends Record<string, unknown>> {
  private _fields: Map<string, FieldConfig<T>> = new Map();
  private _defaultInclude = true;

  fields(config: Record<string, boolean | string | TransformFn<T>>): this {
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'boolean') {
        this._fields.set(key, { include: value });
      } else if (typeof value === 'string') {
        this._fields.set(key, { include: true, rename: value });
      } else if (typeof value === 'function') {
        this._fields.set(key, { include: true, transform: value as TransformFn<T> });
      }
    }
    return this;
  }

  include(...keys: string[]): this {
    for (const key of keys) {
      this._fields.set(key, { include: true });
    }
    return this;
  }

  exclude(...keys: string[]): this {
    for (const key of keys) {
      this._fields.set(key, { include: false });
    }
    return this;
  }

  rename(from: string, to: string): this {
    const existing = this._fields.get(from) ?? { include: true };
    this._fields.set(from, { ...existing, include: true, rename: to });
    return this;
  }

  transformField(key: string, fn: TransformFn<T>): this {
    const existing = this._fields.get(key) ?? { include: true };
    this._fields.set(key, { ...existing, include: true, transform: fn });
    return this;
  }

  when(key: string, condition: FieldCondition<T>): this {
    const existing = this._fields.get(key) ?? { include: true };
    this._fields.set(key, { ...existing, condition });
    return this;
  }

  defaultInclude(value: boolean): this {
    this._defaultInclude = value;
    return this;
  }

  serialize(entity: T): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const keys = Object.keys(entity);

    for (const key of keys) {
      const config = this._fields.get(key);
      const included = config ? config.include : this._defaultInclude;

      if (!included) continue;

      if (config?.condition && !config.condition(entity)) continue;

      const outputKey = config?.rename ?? key;
      let value = entity[key];

      if (config?.transform) {
        value = config.transform(entity) as typeof value;
      }

      result[outputKey] = value;
    }

    return result;
  }

  serializeMany(entities: T[]): Record<string, unknown>[] {
    const result = new Array(entities.length);
    for (let i = 0; i < entities.length; i++) {
      result[i] = this.serialize(entities[i]!);
    }
    return result;
  }
}

export function createSerializer<T extends Record<string, unknown>>(): EntitySerializer<T> {
  return new EntitySerializer<T>();
}
