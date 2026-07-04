import type { Schema, ValidationError, AnySchema } from './types.js';

interface Rule<T> {
  kind: 'check';
  fn: (value: T) => string | null;
}

interface TransformStep<T> {
  kind: 'transform';
  fn: (value: T) => unknown;
}

interface RefineStep<T> {
  kind: 'refine';
  fn: (value: T) => boolean | string;
}

type PipelineStep<T> = Rule<T> | TransformStep<T> | RefineStep<T>;

function cloneSteps(steps: PipelineStep<unknown>[]): PipelineStep<unknown>[] {
  return steps.slice();
}

export class SchemaBase<T> implements Schema<T> {
  readonly _type!: T;
  _kind: string;
  protected _steps: PipelineStep<unknown>[];
  protected _optional = false;
  protected _nullable = false;
  protected _defaultValue: unknown = undefined;
  protected _hasDefault = false;

  constructor(kind: string, baseRules: Rule<T>[] = []) {
    this._kind = kind;
    this._steps = baseRules.map((r) => ({ kind: 'check' as const, fn: r.fn as (v: unknown) => string | null }));
  }

  _validate(value: unknown, path: string[]): { ok: true; value: T } | { ok: false; errors: ValidationError[] } {
    if (value === undefined) {
      if (this._hasDefault) return { ok: true, value: this._defaultValue as T };
      if (this._optional) return { ok: true, value: undefined as unknown as T };
      return { ok: false, errors: [{ path, message: 'Required', code: 'required' }] };
    }

    if (value === null) {
      if (this._nullable) return { ok: true, value: null as unknown as T };
      return { ok: false, errors: [{ path, message: 'Expected non-null', code: 'not_nullable' }] };
    }

    const errors: ValidationError[] = [];
    let current: unknown = value;

    for (const step of this._steps) {
      if (step.kind === 'check') {
        const msg = step.fn(current);
        if (msg !== null) {
          errors.push({ path, message: msg, code: 'validation' });
          break;
        }
      } else if (step.kind === 'transform') {
        current = step.fn(current);
      } else if (step.kind === 'refine') {
        const result = step.fn(current as T);
        if (result === false) {
          errors.push({ path, message: 'Refinement failed', code: 'refine' });
          break;
        }
        if (typeof result === 'string') {
          errors.push({ path, message: result, code: 'refine' });
          break;
        }
      }
    }

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: current as T };
  }

  protected _copy(): this {
    const c = Object.create(Object.getPrototypeOf(this)) as this;
    (c as any)._kind = this._kind;
    (c as any)._steps = cloneSteps(this._steps);
    (c as any)._optional = this._optional;
    (c as any)._nullable = this._nullable;
    (c as any)._defaultValue = this._defaultValue;
    (c as any)._hasDefault = this._hasDefault;
    return c;
  }

  protected _addStep(step: PipelineStep<unknown>): this {
    const c = this._copy();
    ((c as any)._steps as PipelineStep<unknown>[]).push(step);
    return c;
  }

  optional(): SchemaBase<T | undefined> {
    const c = this._copy();
    (c as any)._optional = true;
    return c as SchemaBase<T | undefined>;
  }

  nullable(): SchemaBase<T | null> {
    const c = this._copy();
    (c as any)._nullable = true;
    return c as SchemaBase<T | null>;
  }

  default(value: T): SchemaBase<T> {
    const c = this._copy();
    (c as any)._defaultValue = value;
    (c as any)._hasDefault = true;
    return c;
  }

  transform<U>(fn: (value: T) => U): SchemaBase<U> {
    return this._addStep({ kind: 'transform', fn: fn as (v: unknown) => unknown }) as unknown as SchemaBase<U>;
  }

  refine(fn: (value: T) => boolean | string, message?: string): SchemaBase<T> {
    return this._addStep({
      kind: 'refine',
      fn: ((value: unknown) => {
        const result = fn(value as T);
        if (result === false && message) return message;
        return result;
      }) as (value: unknown) => string | boolean,
    });
  }
}

export class StringSchema extends SchemaBase<string> {
  constructor() {
    super('string', [{ kind: 'check' as const, fn: (v: unknown) => (typeof v !== 'string' ? 'Expected string' : null) }]);
  }

  min(n: number): StringSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as string).length < n ? `String must contain at least ${n} character(s)` : null) }) as StringSchema;
  }

  max(n: number): StringSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as string).length > n ? `String must contain at most ${n} character(s)` : null) }) as StringSchema;
  }

  length(n: number): StringSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as string).length !== n ? `String must be exactly ${n} character(s)` : null) }) as StringSchema;
  }

  email(): StringSchema {
    return this._addStep({ kind: 'check', fn: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) ? null : 'Invalid email address') }) as StringSchema;
  }

  url(): StringSchema {
    return this._addStep({
      kind: 'check',
      fn: (v) => {
        try { new URL(v as string); return null; } catch { return 'Invalid URL'; }
      },
    }) as StringSchema;
  }

  uuid(): StringSchema {
    return this._addStep({ kind: 'check', fn: (v) => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v as string) ? null : 'Invalid UUID') }) as StringSchema;
  }

  regex(pattern: RegExp): StringSchema {
    return this._addStep({ kind: 'check', fn: (v) => (pattern.test(v as string) ? null : 'Invalid string format') }) as StringSchema;
  }

  includes(sub: string): StringSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as string).includes(sub) ? null : `String must include "${sub}"`) }) as StringSchema;
  }

  startsWith(prefix: string): StringSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as string).startsWith(prefix) ? null : `String must start with "${prefix}"`) }) as StringSchema;
  }

  endsWith(suffix: string): StringSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as string).endsWith(suffix) ? null : `String must end with "${suffix}"`) }) as StringSchema;
  }

  trim(): StringSchema {
    return this._addStep({ kind: 'transform', fn: (v) => (v as string).trim() }) as StringSchema;
  }

  toLowerCase(): StringSchema {
    return this._addStep({ kind: 'transform', fn: (v) => (v as string).toLowerCase() }) as StringSchema;
  }

  toUpperCase(): StringSchema {
    return this._addStep({ kind: 'transform', fn: (v) => (v as string).toUpperCase() }) as StringSchema;
  }

  datetime(): StringSchema {
    return this._addStep({
      kind: 'check',
      fn: (v) => {
        const d = new Date(v as string);
        return Number.isNaN(d.getTime()) ? 'Invalid datetime string' : null;
      },
    }) as StringSchema;
  }

  ip(): StringSchema {
    return this._addStep({
      kind: 'check',
      fn: (v) => {
        const s = v as string;
        const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(s);
        const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(s);
        return ipv4 || ipv6 ? null : 'Invalid IP address';
      },
    }) as StringSchema;
  }

  cuid(): StringSchema {
    return this._addStep({ kind: 'check', fn: (v) => (/^c[a-z0-9]{24}$/.test(v as string) ? null : 'Invalid cuid') }) as StringSchema;
  }
}

export class NumberSchema extends SchemaBase<number> {
  constructor() {
    super('number', [{ kind: 'check' as const, fn: (v: unknown) => (typeof v !== 'number' || Number.isNaN(v) ? 'Expected number' : null) }]);
  }

  min(n: number): NumberSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as number) < n ? `Number must be greater than or equal to ${n}` : null) }) as NumberSchema;
  }

  max(n: number): NumberSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as number) > n ? `Number must be less than or equal to ${n}` : null) }) as NumberSchema;
  }

  int(): NumberSchema {
    return this._addStep({ kind: 'check', fn: (v) => (!Number.isInteger(v as number) ? 'Expected integer' : null) }) as NumberSchema;
  }

  positive(): NumberSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as number) <= 0 ? 'Number must be positive' : null) }) as NumberSchema;
  }

  nonnegative(): NumberSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as number) < 0 ? 'Number must be non-negative' : null) }) as NumberSchema;
  }

  negative(): NumberSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as number) >= 0 ? 'Number must be negative' : null) }) as NumberSchema;
  }

  finite(): NumberSchema {
    return this._addStep({ kind: 'check', fn: (v) => (!Number.isFinite(v as number) ? 'Number must be finite' : null) }) as NumberSchema;
  }

  multipleOf(n: number): NumberSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as number) % n !== 0 ? `Number must be a multiple of ${n}` : null) }) as NumberSchema;
  }
}

export class BooleanSchema extends SchemaBase<boolean> {
  constructor() {
    super('boolean', [{ kind: 'check' as const, fn: (v: unknown) => (typeof v !== 'boolean' ? 'Expected boolean' : null) }]);
  }
}

export class DateSchema extends SchemaBase<Date> {
  constructor() {
    super('date', [{ kind: 'check' as const, fn: (v: unknown) => (!(v instanceof Date) || Number.isNaN(v.getTime()) ? 'Expected valid Date' : null) }]);
  }

  min(d: Date): DateSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as Date).getTime() < d.getTime() ? `Date must be after ${d.toISOString()}` : null) }) as DateSchema;
  }

  max(d: Date): DateSchema {
    return this._addStep({ kind: 'check', fn: (v) => ((v as Date).getTime() > d.getTime() ? `Date must be before ${d.toISOString()}` : null) }) as DateSchema;
  }
}

export class ArraySchema<T> extends SchemaBase<T[]> {
  private _itemSchema: AnySchema;

  constructor(itemSchema: AnySchema) {
    super('array');
    this._itemSchema = itemSchema;
    this._steps.push({ kind: 'check' as const, fn: (v: unknown) => (!Array.isArray(v) ? 'Expected array' : null) });
  }

  protected override _copy(): this {
    const c = super._copy();
    (c as any)._itemSchema = this._itemSchema;
    return c;
  }

  override _validate(
    value: unknown,
    path: string[],
  ): { ok: true; value: T[] } | { ok: false; errors: ValidationError[] } {
    const base = super._validate(value, path);
    if (!base.ok) return base;

    const arr = base.value as unknown as unknown[];
    if (!Array.isArray(arr)) {
      return { ok: false, errors: [{ path, message: 'Expected array', code: 'type' }] };
    }

    for (let i = 0; i < arr.length; i++) {
      const itemResult = this._itemSchema._validate(arr[i], [...path, String(i)]);
      if (!itemResult.ok) return { ok: false, errors: itemResult.errors };
    }
    return { ok: true, value: arr as T[] };
  }

  min(n: number): ArraySchema<T> {
    return this._addStep({ kind: 'check', fn: (v) => ((v as T[]).length < n ? `Array must contain at least ${n} element(s)` : null) }) as ArraySchema<T>;
  }

  max(n: number): ArraySchema<T> {
    return this._addStep({ kind: 'check', fn: (v) => ((v as T[]).length > n ? `Array must contain at most ${n} element(s)` : null) }) as ArraySchema<T>;
  }

  length(n: number): ArraySchema<T> {
    return this._addStep({ kind: 'check', fn: (v) => ((v as T[]).length !== n ? `Array must be exactly ${n} element(s)` : null) }) as ArraySchema<T>;
  }
}

export class EnumSchema<T extends readonly string[]> extends SchemaBase<T[number]> {
  private _values: T;
  private _valueSet: Set<string>;

  constructor(values: T) {
    const set = new Set<string>(values);
    super('enum', [{ kind: 'check' as const, fn: (v: unknown) => {
      if (typeof v !== 'string') return 'Expected string';
      if (!set.has(v)) return `Invalid enum value. Expected ${values.join(' | ')}`;
      return null;
    }}]);
    this._values = values;
    this._valueSet = set;
  }

  get values(): T { return this._values; }

  protected override _copy(): this {
    const c = super._copy();
    (c as any)._values = this._values;
    (c as any)._valueSet = this._valueSet;
    return c;
  }
}

export class LiteralSchema<T extends string | number | boolean | null> extends SchemaBase<T> {
  private _literalValue: T;

  constructor(value: T) {
    super('literal', [{ kind: 'check' as const, fn: (v: unknown) => (v !== value ? `Expected literal ${JSON.stringify(value)}` : null) }]);
    this._literalValue = value;
  }

  get value(): T { return this._literalValue; }
}

export class UnionSchema<TS extends readonly AnySchema[]> extends SchemaBase<any> {
  private _schemas: TS;

  constructor(schemas: TS) {
    super('union');
    this._schemas = schemas;
  }

  protected override _copy(): this {
    const c = super._copy();
    (c as any)._schemas = this._schemas;
    return c;
  }

  override _validate(value: unknown, path: string[]): { ok: true; value: any } | { ok: false; errors: ValidationError[] } {
    if (value === undefined) {
      if (this._hasDefault) return { ok: true, value: this._defaultValue };
      if (this._optional) return { ok: true, value: undefined };
      return { ok: false, errors: [{ path, message: 'Required', code: 'required' }] };
    }
    if (value === null && this._nullable) return { ok: true, value: null };

    for (const schema of this._schemas) {
      const result = schema._validate(value, path);
      if (result.ok) return result;
    }

    return { ok: false, errors: [{ path, message: 'Invalid input', code: 'union' }] };
  }
}

export class DiscriminatedUnionSchema<D extends string, TS extends readonly AnySchema[]> extends SchemaBase<any> {
  private _discriminator: D;
  private _schemaMap: Map<string, AnySchema>;

  constructor(discriminator: D, schemas: TS) {
    super('discriminated_union');
    this._discriminator = discriminator;
    this._schemaMap = new Map();

    for (const schema of schemas) {
      const shape = (schema as any)._shape;
      if (shape && shape[discriminator]) {
        const discSchema = shape[discriminator] as LiteralSchema<string>;
        if (discSchema._kind === 'literal') {
          this._schemaMap.set(String(discSchema.value), schema);
        }
      }
    }
  }

  protected override _copy(): this {
    const c = super._copy();
    (c as any)._discriminator = this._discriminator;
    (c as any)._schemaMap = new Map(this._schemaMap);
    return c;
  }

  override _validate(value: unknown, path: string[]): { ok: true; value: any } | { ok: false; errors: ValidationError[] } {
    if (value === undefined) {
      if (this._hasDefault) return { ok: true, value: this._defaultValue };
      if (this._optional) return { ok: true, value: undefined };
      return { ok: false, errors: [{ path, message: 'Required', code: 'required' }] };
    }
    if (value === null && this._nullable) return { ok: true, value: null };

    if (typeof value !== 'object' || value === null) {
      return { ok: false, errors: [{ path, message: 'Expected object', code: 'type' }] };
    }

    const discValue = (value as Record<string, unknown>)[this._discriminator];
    if (typeof discValue !== 'string') {
      return {
        ok: false,
        errors: [{ path: [...path, this._discriminator], message: `Discriminator "${this._discriminator}" must be a string`, code: 'discriminator' }],
      };
    }

    const schema = this._schemaMap.get(discValue);
    if (!schema) {
      return {
        ok: false,
        errors: [{ path: [...path, this._discriminator], message: `Invalid discriminator value: "${discValue}"`, code: 'discriminator' }],
      };
    }

    return schema._validate(value, path);
  }
}

export class AnySchema_ extends SchemaBase<any> {
  constructor() {
    super('any');
  }

  override _validate(value: unknown, _path: string[]): { ok: true; value: any } | { ok: false; errors: ValidationError[] } {
    if (value === undefined) {
      if (this._hasDefault) return { ok: true, value: this._defaultValue };
      return { ok: true, value: undefined };
    }
    return { ok: true, value };
  }
}

export class UnknownSchema extends SchemaBase<unknown> {
  constructor() {
    super('unknown');
  }

  override _validate(value: unknown, _path: string[]): { ok: true; value: unknown } | { ok: false; errors: ValidationError[] } {
    if (value === undefined) {
      if (this._hasDefault) return { ok: true, value: this._defaultValue };
      return { ok: true, value: undefined };
    }
    return { ok: true, value };
  }
}
