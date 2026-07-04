import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RadixRouter } from './radix-router.js';

describe('RadixRouter', () => {
  const handler = { controllerToken: 'TestController', methodName: 'test' };

  describe('static paths', () => {
    test('matches exact path', () => {
      const router = new RadixRouter();
      router.add('GET', '/users', handler);
      const match = router.find('GET', '/users');
      assert.ok(match);
      assert.deepEqual(match!.handler, handler);
      assert.deepEqual(match!.params, {});
    });

    test('matches nested static path', () => {
      const router = new RadixRouter();
      router.add('GET', '/api/v1/health', handler);
      const match = router.find('GET', '/api/v1/health');
      assert.ok(match);
      assert.deepEqual(match!.handler, handler);
    });

    test('matches root path', () => {
      const router = new RadixRouter();
      router.add('GET', '/', handler);
      const match = router.find('GET', '/');
      assert.ok(match);
    });

    test('returns null for unmatched path', () => {
      const router = new RadixRouter();
      router.add('GET', '/users', handler);
      assert.equal(router.find('GET', '/posts'), null);
    });

    test('returns null for unmatched method', () => {
      const router = new RadixRouter();
      router.add('GET', '/users', handler);
      assert.equal(router.find('POST', '/users'), null);
    });

    test('different methods on same path', () => {
      const router = new RadixRouter();
      const getHandler = { controllerToken: 'Test', methodName: 'get' };
      const postHandler = { controllerToken: 'Test', methodName: 'post' };
      router.add('GET', '/users', getHandler);
      router.add('POST', '/users', postHandler);
      assert.deepEqual(router.find('GET', '/users')!.handler, getHandler);
      assert.deepEqual(router.find('POST', '/users')!.handler, postHandler);
    });
  });

  describe('parameterized paths', () => {
    test('matches single param', () => {
      const router = new RadixRouter();
      router.add('GET', '/users/:id', handler);
      const match = router.find('GET', '/users/42');
      assert.ok(match);
      assert.equal(match!.params['id'], '42');
    });

    test('matches multiple params', () => {
      const router = new RadixRouter();
      router.add('GET', '/users/:userId/posts/:postId', handler);
      const match = router.find('GET', '/users/5/posts/12');
      assert.ok(match);
      assert.equal(match!.params['userId'], '5');
      assert.equal(match!.params['postId'], '12');
    });

    test('matches param with static prefix', () => {
      const router = new RadixRouter();
      router.add('GET', '/api/:version/users', handler);
      const match = router.find('GET', '/api/v2/users');
      assert.ok(match);
      assert.equal(match!.params['version'], 'v2');
    });

    test('returns null for param path missing segments', () => {
      const router = new RadixRouter();
      router.add('GET', '/users/:id/posts', handler);
      assert.equal(router.find('GET', '/users/42'), null);
    });
  });

  describe('nested params', () => {
    test('literal routes preferred over params', () => {
      const router = new RadixRouter();
      const literalHandler = { controllerToken: 'Test', methodName: 'literal' };
      const paramHandler = { controllerToken: 'Test', methodName: 'param' };
      router.add('GET', '/users/me', literalHandler);
      router.add('GET', '/users/:id', paramHandler);
      const literalMatch = router.find('GET', '/users/me');
      assert.deepEqual(literalMatch!.handler, literalHandler);
      const paramMatch = router.find('GET', '/users/42');
      assert.deepEqual(paramMatch!.handler, paramHandler);
      assert.equal(paramMatch!.params['id'], '42');
    });

    test('deep nested params', () => {
      const router = new RadixRouter();
      router.add('GET', '/a/:b/c/:d/e', handler);
      const match = router.find('GET', '/a/1/c/2/e');
      assert.ok(match);
      assert.equal(match!.params['b'], '1');
      assert.equal(match!.params['d'], '2');
    });
  });

  describe('ANY method', () => {
    test('matches all methods', () => {
      const router = new RadixRouter();
      router.add('ANY', '/catch-all', handler);
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        assert.ok(router.find(method, '/catch-all'));
      }
    });
  });

  describe('404 handling', () => {
    test('returns null for completely unknown path', () => {
      const router = new RadixRouter();
      router.add('GET', '/known', handler);
      assert.equal(router.find('GET', '/unknown'), null);
    });

    test('returns null for partial match', () => {
      const router = new RadixRouter();
      router.add('GET', '/users/:id', handler);
      assert.equal(router.find('GET', '/users'), null);
    });

    test('returns null for longer path', () => {
      const router = new RadixRouter();
      router.add('GET', '/users', handler);
      assert.equal(router.find('GET', '/users/42'), null);
    });

    test('returns null for empty router', () => {
      const router = new RadixRouter();
      assert.equal(router.find('GET', '/anything'), null);
    });
  });

  describe('utility methods', () => {
    test('size tracks route count', () => {
      const router = new RadixRouter();
      assert.equal(router.size(), 0);
      router.add('GET', '/a', handler);
      assert.equal(router.size(), 1);
      router.add('POST', '/b', handler);
      assert.equal(router.size(), 2);
    });

    test('getAllRoutes returns all registered routes', () => {
      const router = new RadixRouter();
      router.add('GET', '/users', handler);
      router.add('POST', '/users', handler);
      router.add('GET', '/users/:id', handler);
      const routes = router.getAllRoutes();
      assert.ok(routes.length >= 3);
    });

    test('meta is preserved on routes', () => {
      const router = new RadixRouter();
      const meta = { guards: [], description: 'test' };
      router.add('GET', '/test', handler, meta);
      const match = router.find('GET', '/test');
      assert.deepEqual(match!.meta, meta);
    });
  });
});
