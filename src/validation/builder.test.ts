import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { v, QweValidationError } from './index.js';

describe('v.string()', () => {
  test('accepts valid strings', () => {
    const result = v.safeParse(v.string(), 'hello');
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data, 'hello');
  });

  test('rejects non-strings', () => {
    const result = v.safeParse(v.string(), 42);
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.errors[0]!.code, 'validation');
  });

  test('rejects undefined', () => {
    const result = v.safeParse(v.string(), undefined);
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.errors[0]!.code, 'required');
  });

  test('min/max constraints', () => {
    const schema = v.string().min(2).max(5);
    assert.equal(v.safeParse(schema, 'ab').success, true);
    assert.equal(v.safeParse(schema, 'a').success, false);
    assert.equal(v.safeParse(schema, 'abcdef').success, false);
  });

  test('email validation', () => {
    const schema = v.string().email();
    assert.equal(v.safeParse(schema, 'user@example.com').success, true);
    assert.equal(v.safeParse(schema, 'invalid').success, false);
  });

  test('trim transform', () => {
    const schema = v.string().trim();
    const result = v.safeParse(schema, '  hello  ');
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data, 'hello');
  });

  test('optional allows undefined', () => {
    const schema = v.string().optional();
    const result = v.safeParse(schema, undefined);
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data, undefined);
  });

  test('nullable allows null', () => {
    const schema = v.string().nullable();
    const result = v.safeParse(schema, null);
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data, null);
  });

  test('default value', () => {
    const schema = v.string().default('fallback');
    const result = v.safeParse(schema, undefined);
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data, 'fallback');
  });
});

describe('v.number()', () => {
  test('accepts valid numbers', () => {
    const result = v.safeParse(v.number(), 42);
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data, 42);
  });

  test('rejects NaN', () => {
    const result = v.safeParse(v.number(), NaN);
    assert.equal(result.success, false);
  });

  test('rejects strings', () => {
    const result = v.safeParse(v.number(), '42');
    assert.equal(result.success, false);
  });

  test('min/max constraints', () => {
    const schema = v.number().min(0).max(100);
    assert.equal(v.safeParse(schema, 50).success, true);
    assert.equal(v.safeParse(schema, -1).success, false);
    assert.equal(v.safeParse(schema, 101).success, false);
  });

  test('int constraint', () => {
    const schema = v.number().int();
    assert.equal(v.safeParse(schema, 5).success, true);
    assert.equal(v.safeParse(schema, 5.5).success, false);
  });

  test('positive constraint', () => {
    const schema = v.number().positive();
    assert.equal(v.safeParse(schema, 1).success, true);
    assert.equal(v.safeParse(schema, 0).success, false);
    assert.equal(v.safeParse(schema, -1).success, false);
  });
});

describe('v.object()', () => {
  const userSchema = v.object({
    name: v.string(),
    age: v.number(),
  });

  test('accepts valid objects', () => {
    const result = v.safeParse(userSchema, { name: 'Alice', age: 30 });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.name, 'Alice');
      assert.equal(result.data.age, 30);
    }
  });

  test('rejects missing fields', () => {
    const result = v.safeParse(userSchema, { name: 'Alice' });
    assert.equal(result.success, false);
  });

  test('rejects wrong types', () => {
    const result = v.safeParse(userSchema, { name: 'Alice', age: 'thirty' });
    assert.equal(result.success, false);
  });

  test('rejects null', () => {
    const result = v.safeParse(userSchema, null);
    assert.equal(result.success, false);
  });

  test('rejects primitive values', () => {
    assert.equal(v.safeParse(userSchema, 'string').success, false);
    assert.equal(v.safeParse(userSchema, 42).success, false);
    assert.equal(v.safeParse(userSchema, true).success, false);
  });

  test('strips extra keys by default', () => {
    const result = v.safeParse(userSchema, { name: 'Alice', age: 30, extra: true });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.name, 'Alice');
      assert.equal(result.data.age, 30);
      assert.equal((result.data as Record<string, unknown>)['extra'], undefined);
    }
  });

  test('strict mode rejects extra keys', () => {
    const strict = userSchema.strict();
    const result = v.safeParse(strict, { name: 'Alice', age: 30, extra: true });
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.errors[0]!.code, 'unrecognized_keys');
  });

  test('passthrough keeps extra keys', () => {
    const pt = userSchema.passthrough();
    const result = v.safeParse(pt, { name: 'Alice', age: 30, extra: true });
    assert.equal(result.success, true);
    if (result.success) assert.equal((result.data as Record<string, unknown>)['extra'], true);
  });

  test('partial makes all fields optional', () => {
    const partialSchema = userSchema.partial();
    const result = v.safeParse(partialSchema, { name: 'Alice' });
    assert.equal(result.success, true);
  });

  test('pick selects fields', () => {
    const picked = userSchema.pick(['name']);
    const result = v.safeParse(picked, { name: 'Alice' });
    assert.equal(result.success, true);
  });

  test('nested objects validate', () => {
    const schema = v.object({
      profile: v.object({
        name: v.string(),
      }),
    });
    assert.equal(v.safeParse(schema, { profile: { name: 'Bob' } }).success, true);
    assert.equal(v.safeParse(schema, { profile: { name: 42 } }).success, false);
  });
});

describe('v.array()', () => {
  test('accepts valid arrays', () => {
    const schema = v.array(v.number());
    const result = v.safeParse(schema, [1, 2, 3]);
    assert.equal(result.success, true);
    if (result.success) assert.deepEqual(result.data, [1, 2, 3]);
  });

  test('rejects non-arrays', () => {
    const schema = v.array(v.string());
    assert.equal(v.safeParse(schema, 'not-array').success, false);
  });

  test('validates item types', () => {
    const schema = v.array(v.number());
    assert.equal(v.safeParse(schema, [1, 'two', 3]).success, false);
  });

  test('min/max length', () => {
    const schema = v.array(v.string()).min(1).max(3);
    assert.equal(v.safeParse(schema, []).success, false);
    assert.equal(v.safeParse(schema, ['a']).success, true);
    assert.equal(v.safeParse(schema, ['a', 'b', 'c', 'd']).success, false);
  });

  test('empty array is valid', () => {
    const schema = v.array(v.string());
    assert.equal(v.safeParse(schema, []).success, true);
  });
});

describe('v.parse()', () => {
  test('returns parsed value on success', () => {
    const schema = v.object({ name: v.string() });
    const result = v.parse(schema, { name: 'Test' });
    assert.equal(result.name, 'Test');
  });

  test('throws QweValidationError on failure', () => {
    const schema = v.object({ name: v.string() });
    assert.throws(
      () => v.parse(schema, { name: 42 }),
      (err: unknown) => {
        assert.ok(err instanceof QweValidationError);
        assert.ok((err as QweValidationError).errors.length > 0);
        return true;
      },
    );
  });

  test('error messages include path info', () => {
    const schema = v.object({ user: v.object({ age: v.number() }) });
    try {
      v.parse(schema, { user: { age: 'not a number' } });
      assert.fail('should throw');
    } catch (err) {
      const validationErr = err as QweValidationError;
      const ageErr = validationErr.errors.find((e) => e.path.includes('age'));
      assert.ok(ageErr);
      assert.deepEqual(ageErr!.path, ['user', 'age']);
    }
  });
});

describe('v.safeParse()', () => {
  test('returns success result on valid', () => {
    const result = v.safeParse(v.string(), 'hello');
    assert.equal(result.success, true);
    assert.equal(result.error, undefined);
  });

  test('returns failure result on invalid', () => {
    const result = v.safeParse(v.string(), 42);
    assert.equal(result.success, false);
    assert.equal(result.data, undefined);
    if (!result.success) assert.ok(result.error.errors.length > 0);
  });
});

describe('transforms and refiners', () => {
  test('transform step', () => {
    const schema = v.string().toUpperCase();
    const result = v.safeParse(schema, 'hello');
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data, 'HELLO');
  });

  test('refine step', () => {
    const schema = v.number().refine((n) => n % 2 === 0, 'Must be even');
    assert.equal(v.safeParse(schema, 4).success, true);
    assert.equal(v.safeParse(schema, 3).success, false);
  });

  test('chained validations', () => {
    const schema = v.string().min(3).max(10).trim().toLowerCase();
    const result = v.safeParse(schema, '  HELLO  ');
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data, 'hello');
  });

  test('enum validation', () => {
    const schema = v.enum(['admin', 'user', 'guest'] as const);
    assert.equal(v.safeParse(schema, 'admin').success, true);
    assert.equal(v.safeParse(schema, 'superuser').success, false);
  });

  test('literal validation', () => {
    const schema = v.literal('exact');
    assert.equal(v.safeParse(schema, 'exact').success, true);
    assert.equal(v.safeParse(schema, 'other').success, false);
  });

  test('union validation', () => {
    const schema = v.union([v.string(), v.number()]);
    assert.equal(v.safeParse(schema, 'text').success, true);
    assert.equal(v.safeParse(schema, 42).success, true);
    assert.equal(v.safeParse(schema, true).success, false);
  });
});
