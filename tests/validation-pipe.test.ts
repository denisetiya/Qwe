import { describe, it } from 'node:test';
import assert from 'node:assert';
import { v } from '../src/validation/index.js';
import { validationPipe } from '../src/validation/pipe.js';
import type { ExecutionContext } from '../src/http/context.js';

describe('Validation Pipe', () => {
  it('validates request body and passes valid data', async () => {
    const schema = v.object({
      name: v.string().min(2),
      age: v.number().min(0),
    });

    const pipe = await validationPipe({ body: schema, transform: true });

    let nextCalled = false;
    const mockCtx = {
      request: {
        method: 'POST',
        url: '/test',
        path: '/test',
        headers: { 'content-type': 'application/json' },
        body: { name: 'John', age: 25 },
        cookies: {},
        ip: '127.0.0.1',
        startTime: Date.now(),
      },
      response: {
        status: (code: number) => ({
          json: (data: any) => {
            // Should not be called for valid data
          },
        }),
        json: (data: any) => {},
      },
    } as ExecutionContext;

    await pipe(mockCtx, async () => {
      nextCalled = true;
      // Body should be transformed/sanitized
      const body = mockCtx.request.body as any;
      assert.strictEqual(body.name, 'John');
      assert.strictEqual(body.age, 25);
    });

    assert.ok(nextCalled, 'Next should have been called for valid data');
  });

  it('rejects invalid request body', async () => {
    const schema = v.object({
      name: v.string().min(2),
      age: v.number().min(0),
    });

    const pipe = await validationPipe({ body: schema });

    let nextCalled = false;
    let responseStatusCalled = false;

    const mockCtx = {
      request: {
        method: 'POST',
        url: '/test',
        path: '/test',
        headers: { 'content-type': 'application/json' },
        body: { name: 'J', age: -5 },
        cookies: {},
        ip: '127.0.0.1',
        startTime: Date.now(),
      },
      response: {
        status: (code: number) => {
          responseStatusCalled = true;
          assert.strictEqual(code, 400);
          return {
            json: (data: any) => {
              assert.ok(data.details);
              assert.ok(data.details.length > 0);
            },
          };
        },
        json: (data: any) => {},
      },
    } as ExecutionContext;

    await pipe(mockCtx, async () => {
      nextCalled = true;
    });

    assert.ok(!nextCalled, 'Next should not have been called for invalid data');
    assert.ok(responseStatusCalled, 'Response status should have been set to 400');
  });

  it('validates query parameters', async () => {
    const schema = v.object({
      page: v.string().regex(/^\d+$/),
      limit: v.string().regex(/^\d+$/),
    });

    const pipe = await validationPipe({ query: schema, transform: true });

    let nextCalled = false;
    const mockCtx = {
      request: {
        method: 'GET',
        url: '/test?page=1&limit=10',
        path: '/test',
        headers: {},
        query: { page: '1', limit: '10' },
        cookies: {},
        ip: '127.0.0.1',
        startTime: Date.now(),
      },
      response: {
        status: (code: number) => ({
          json: (data: any) => {},
        }),
        json: (data: any) => {},
      },
    } as ExecutionContext;

    await pipe(mockCtx, async () => {
      nextCalled = true;
    });

    assert.ok(nextCalled, 'Next should have been called for valid query params');
  });

  it('validates URL parameters', async () => {
    const schema = v.object({
      id: v.string().regex(/^\d+$/),
    });

    const pipe = await validationPipe({ params: schema, transform: true });

    let nextCalled = false;
    const mockCtx = {
      request: {
        method: 'GET',
        url: '/users/123',
        path: '/users/123',
        headers: {},
        params: { id: '123' },
        cookies: {},
        ip: '127.0.0.1',
        startTime: Date.now(),
      },
      response: {
        status: (code: number) => ({
          json: (data: any) => {},
        }),
        json: (data: any) => {},
      },
    } as ExecutionContext;

    await pipe(mockCtx, async () => {
      nextCalled = true;
    });

    assert.ok(nextCalled, 'Next should have been called for valid params');
  });

  it('validates multiple sources simultaneously', async () => {
    const bodySchema = v.object({
      title: v.string().min(3),
    });

    const paramsSchema = v.object({
      id: v.string().regex(/^\d+$/),
    });

    const pipe = await validationPipe({
      body: bodySchema,
      params: paramsSchema,
      transform: true,
    });

    let nextCalled = false;
    const mockCtx = {
      request: {
        method: 'PUT',
        url: '/posts/123',
        path: '/posts/123',
        headers: { 'content-type': 'application/json' },
        params: { id: '123' },
        body: { title: 'Valid Title' },
        cookies: {},
        ip: '127.0.0.1',
        startTime: Date.now(),
      },
      response: {
        status: (code: number) => ({
          json: (data: any) => {},
        }),
        json: (data: any) => {},
      },
    } as ExecutionContext;

    await pipe(mockCtx, async () => {
      nextCalled = true;
    });

    assert.ok(nextCalled, 'Next should have been called when all validations pass');
  });

  it('collects all validation errors', async () => {
    const schema = v.object({
      name: v.string().min(2),
      email: v.string().email(),
      age: v.number().min(0),
    });

    const pipe = await validationPipe({ body: schema });

    let nextCalled = false;
    let capturedErrors: any[] = [];

    const mockCtx = {
      request: {
        method: 'POST',
        url: '/test',
        path: '/test',
        headers: { 'content-type': 'application/json' },
        body: { name: 'J', email: 'invalid', age: -5 },
        cookies: {},
        ip: '127.0.0.1',
        startTime: Date.now(),
      },
      response: {
        status: (code: number) => {
          return {
            json: (data: any) => {
              capturedErrors = data.details || [];
            },
          };
        },
        json: (data: any) => {},
      },
    } as ExecutionContext;

    await pipe(mockCtx, async () => {
      nextCalled = true;
    });

    assert.ok(!nextCalled, 'Next should not have been called');
    assert.ok(capturedErrors.length >= 1, 'Should have at least one body-level error');
    assert.ok(capturedErrors.some((e: any) => e.field === 'body'), 'Should have body validation error');
  });
});