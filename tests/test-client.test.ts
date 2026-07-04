import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createTestClient } from '../src/testing/test-client.js';
import { RadixRouter } from '../src/http/radix-router.js';
import { Container } from '../src/core/container.js';
import type { ExecutionContext } from '../src/http/context.js';

describe('Test Client', () => {
  let router: RadixRouter;
  let container: Container;
  let client: ReturnType<typeof createTestClient>;

  before(() => {
    router = new RadixRouter();
    container = new Container();

    // Register a simple controller
    class TestController {
      getAll(ctx: ExecutionContext) {
        ctx.response.ok({ items: [1, 2, 3] });
      }

      getById(ctx: ExecutionContext) {
        const { id } = ctx.request.params;
        ctx.response.ok({ id, name: `Item ${id}` });
      }

      create(ctx: ExecutionContext) {
        const body = ctx.request.body;
        ctx.response.created({ id: 1, ...body });
      }

      update(ctx: ExecutionContext) {
        const { id } = ctx.request.params;
        const body = ctx.request.body;
        ctx.response.ok({ id, ...body });
      }

      delete(ctx: ExecutionContext) {
        ctx.response.status(204).json(null);
      }

      withQuery(ctx: ExecutionContext) {
        const query = ctx.request.query;
        ctx.response.ok({ query });
      }
    }

    container.register('TestController', () => new TestController());

    // Register routes
    router.add('GET', '/items', {
      controllerToken: 'TestController',
      methodName: 'getAll',
    });

    router.add('GET', '/items/:id', {
      controllerToken: 'TestController',
      methodName: 'getById',
    });

    router.add('POST', '/items', {
      controllerToken: 'TestController',
      methodName: 'create',
    });

    router.add('PUT', '/items/:id', {
      controllerToken: 'TestController',
      methodName: 'update',
    });

    router.add('DELETE', '/items/:id', {
      controllerToken: 'TestController',
      methodName: 'delete',
    });

    router.add('GET', '/search', {
      controllerToken: 'TestController',
      methodName: 'withQuery',
    });

    client = createTestClient({ router, container });
  });

  it('makes GET requests', async () => {
    const response = await client.get('/items');
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, { items: [1, 2, 3] });
  });

  it('handles route parameters', async () => {
    const response = await client.get('/items/42');
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, { id: '42', name: 'Item 42' });
  });

  it('makes POST requests with body', async () => {
    const response = await client.post('/items', { name: 'New Item', price: 99.99 });
    assert.strictEqual(response.status, 201);
    assert.deepStrictEqual(response.body, { id: 1, name: 'New Item', price: 99.99 });
  });

  it('makes PUT requests with body and params', async () => {
    const response = await client.put('/items/5', { name: 'Updated' });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, { id: '5', name: 'Updated' });
  });

  it('makes DELETE requests', async () => {
    const response = await client.delete('/items/10');
    assert.strictEqual(response.status, 204);
  });

  it('handles query parameters', async () => {
    const response = await client.get('/search', { query: { q: 'test', page: '1' } });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, { query: { q: 'test', page: '1' } });
  });

  it('returns 404 for unknown routes', async () => {
    const response = await client.get('/unknown');
    assert.strictEqual(response.status, 404);
  });

  it('supports custom headers', async () => {
    const response = await client.get('/items', {
      headers: { 'x-custom': 'test-value' },
    });
    assert.strictEqual(response.status, 200);
  });

  it('handles all HTTP methods', async () => {
    const getResponse = await client.get('/items');
    assert.strictEqual(getResponse.status, 200);

    const postResponse = await client.post('/items', { data: 'test' });
    assert.strictEqual(postResponse.status, 201);

    const putResponse = await client.put('/items/1', { data: 'test' });
    assert.strictEqual(putResponse.status, 200);

    const deleteResponse = await client.delete('/items/1');
    assert.strictEqual(deleteResponse.status, 204);
  });
});