import type { AnySchema, Shape, InferShape, Infer, Prettify, LiteralValue } from './types.js';
import {
  StringSchema,
  NumberSchema,
  BooleanSchema,
  DateSchema,
  ArraySchema,
  EnumSchema,
  LiteralSchema,
  UnionSchema,
  DiscriminatedUnionSchema,
  AnySchema_,
  UnknownSchema,
  SchemaBase,
} from './rules.js';

export class ObjectSchema<S extends Shape> extends SchemaBase<Prettify<InferShape<S>>> {
  _shape: S;
  private _strict = false;
  private _passthrough = false;

  constructor(shape: S) {
    super('object');
    this._shape = shape;
  }

  protected override _copy(): this {
    const c = super._copy();
    (c as any)._shape = this._shape;
    (c as any)._strict = this._strict;
    (c as any)._passthrough = this._passthrough;
    return c;
  }

  override _validate(
    value: unknown,
    path: string[],
  ): { ok: true; value: any } | { ok: false; errors: import('./types.js').ValidationError[] } {
    if (value === undefined) {
      if (this._hasDefault) return { ok: true, value: this._defaultValue };
      if (this._optional) return { ok: true, value: undefined };
      return { ok: false, errors: [{ path, message: 'Required', code: 'required' }] };
    }
    if (value === null) {
      if (this._nullable) return { ok: true, value: null };
      return { ok: false, errors: [{ path, message: 'Expected non-null', code: 'not_nullable' }] };
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, errors: [{ path, message: 'Expected object', code: 'type' }] };
    }

    const obj = value as Record<string, unknown>;
    const errors: import('./types.js').ValidationError[] = [];
    const result: Record<string, unknown> = {};
    const shapeKeys = Object.keys(this._shape);

    for (const key of shapeKeys) {
      const fieldSchema = this._shape[key]!;
      const fieldResult = fieldSchema._validate(obj[key], [...path, key]);
      if (fieldResult.ok) {
        result[key] = fieldResult.value;
      } else {
        errors.push(...fieldResult.errors);
      }
    }

    if (errors.length > 0) return { ok: false, errors };

    if (this._strict) {
      const extraKeys = Object.keys(obj).filter((k) => !shapeKeys.includes(k));
      if (extraKeys.length > 0) {
        return {
          ok: false,
          errors: extraKeys.map((k) => ({
            path: [...path, k],
            message: `Unrecognized key: "${k}"`,
            code: 'unrecognized_keys',
          })),
        };
      }
    } else if (this._passthrough) {
      for (const key of Object.keys(obj)) {
        if (!shapeKeys.includes(key)) {
          result[key] = obj[key];
        }
      }
    }

    return { ok: true, value: result };
  }

  strict(): ObjectSchema<S> {
    const c = this._copy();
    (c as any)._strict = true;
    return c as ObjectSchema<S>;
  }

  passthrough(): ObjectSchema<S> {
    const c = this._copy();
    (c as any)._passthrough = true;
    return c as ObjectSchema<S>;
  }

  partial(): ObjectSchema<Shape> {
    const newShape: Record<string, AnySchema> = {};
    for (const [key, schema] of Object.entries(this._shape)) {
      newShape[key] = (schema as SchemaBase<unknown>).optional() as AnySchema;
    }
    return new ObjectSchema(newShape);
  }

  required(): ObjectSchema<S> {
    return new ObjectSchema(this._shape);
  }

  pick<K extends keyof S>(keys: readonly K[]): ObjectSchema<Pick<S, K>> {
    const newShape = {} as Record<string, AnySchema>;
    for (const key of keys) {
      newShape[key as string] = this._shape[key]!;
    }
    return new ObjectSchema(newShape as any);
  }

  omit<const K extends keyof S>(keys: readonly K[]): ObjectSchema<Omit<S, K>> {
    const newShape = {} as Record<string, AnySchema>;
    for (const [key, schema] of Object.entries(this._shape)) {
      if (!keys.includes(key as unknown as K)) {
        newShape[key] = schema as AnySchema;
      }
    }
    return new ObjectSchema(newShape as any);
  }

  merge<E extends Shape>(other: ObjectSchema<E>): ObjectSchema<S & E> {
    return new ObjectSchema({ ...this._shape, ...other._shape } as any);
  }

  extend<E extends Shape>(extra: E): ObjectSchema<S & E> {
    return new ObjectSchema({ ...this._shape, ...extra } as any);
  }
}

export function string(): StringSchema {
  return new StringSchema();
}

export function number(): NumberSchema {
  return new NumberSchema();
}

export function boolean(): BooleanSchema {
  return new BooleanSchema();
}

export function date(): DateSchema {
  return new DateSchema();
}

export function array<T extends AnySchema>(itemSchema: T): ArraySchema<Infer<T>> {
  return new ArraySchema(itemSchema);
}

export function object<S extends Shape>(shape: S): ObjectSchema<S> {
  return new ObjectSchema(shape);
}

export function enum_<T extends readonly string[]>(values: T): EnumSchema<T> {
  return new EnumSchema(values);
}

export function literal<T extends LiteralValue>(value: T): LiteralSchema<T> {
  return new LiteralSchema(value);
}

export function union<T extends readonly [AnySchema, AnySchema, ...AnySchema[]]>(
  schemas: T,
): UnionSchema<T> {
  return new UnionSchema(schemas);
}

export function discriminatedUnion<
  D extends string,
  S extends readonly [AnySchema, AnySchema, ...AnySchema[]],
>(discriminator: D, schemas: S): DiscriminatedUnionSchema<D, S> {
  return new DiscriminatedUnionSchema(discriminator, schemas);
}

export function any(): AnySchema_ {
  return new AnySchema_();
}

export function unknown(): UnknownSchema {
  return new UnknownSchema();
}

export function nullable<T extends AnySchema>(schema: T): SchemaBase<Infer<T> | null> {
  return (schema as unknown as SchemaBase<Infer<T>>).nullable();
}

export function optional<T extends AnySchema>(schema: T): SchemaBase<Infer<T> | undefined> {
  return (schema as unknown as SchemaBase<Infer<T>>).optional();
}
