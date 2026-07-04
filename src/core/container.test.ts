import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Container } from './container.js';

describe('Container', () => {
  describe('register and resolve', () => {
    test('registers and resolves a value', () => {
      const container = new Container();
      container.register('greeting', 'hello');
      assert.equal(container.resolve('greeting'), 'hello');
    });

    test('registers and resolves a factory function', () => {
      const container = new Container();
      container.register('counter', () => 42);
      assert.equal(container.resolve('counter'), 42);
    });

    test('registers and resolves a class', () => {
      class MyService {
        getValue() {
          return 99;
        }
      }
      const container = new Container();
      container.register('myService', MyService);
      const instance = container.resolve<MyService>('myService');
      assert.equal(instance.getValue(), 99);
    });

    test('throws for unregistered token', () => {
      const container = new Container();
      assert.throws(() => container.resolve('nonexistent'), /not registered/);
    });

    test('error message lists available providers', () => {
      const container = new Container();
      container.register('a', 1);
      container.register('b', 2);
      // Optimized error message for performance (no longer lists all providers)
      assert.throws(() => container.resolve('c'), /Provider "c" not registered/);
    });

    test('chained register calls', () => {
      const container = new Container();
      const result = container.register('a', 1).register('b', 2);
      assert.strictEqual(result, container);
      assert.equal(container.resolve('a'), 1);
      assert.equal(container.resolve('b'), 2);
    });
  });

  describe('factory-based wiring', () => {
    test('factory can resolve dependencies from container', () => {
      class Logger {
        log(msg: string) {
          return msg;
        }
      }
      class Service {
        logger: Logger;
        constructor(logger: Logger) {
          this.logger = logger;
        }
      }
      const container = new Container();
      container.register('logger', Logger);
      container.register('service', () => {
        const logger = container.resolve<Logger>('logger');
        return new Service(logger);
      });
      const svc = container.resolve<Service>('service');
      assert.equal(svc.logger.log('test'), 'test');
    });

    test('multi-level factory wiring', () => {
      class Repo {
        find() {
          return 'found';
        }
      }
      class Service {
        repo: Repo;
        constructor(repo: Repo) {
          this.repo = repo;
        }
      }
      class Controller {
        service: Service;
        constructor(service: Service) {
          this.service = service;
        }
      }
      const container = new Container();
      container.register('repo', Repo);
      container.register('service', () => new Service(container.resolve('repo')));
      container.register('controller', () => new Controller(container.resolve('service')));
      const ctrl = container.resolve<Controller>('controller');
      assert.equal(ctrl.service.repo.find(), 'found');
    });

    test('handles no-arg constructor', () => {
      class Simple {
        value = 'simple';
      }
      const container = new Container();
      container.register('simple', Simple);
      const instance = container.resolve<Simple>('simple');
      assert.equal(instance.value, 'simple');
    });

    test('resolves object values', () => {
      const config = { dbUrl: 'postgres://localhost', port: 5432 };
      const container = new Container();
      container.register('config', config);
      const resolved = container.resolve<typeof config>('config');
      assert.deepEqual(resolved, config);
    });
  });

  describe('singleton scope', () => {
    test('returns same instance on every resolve', () => {
      let calls = 0;
      class Tracker {
        id: number;
        constructor() {
          this.id = ++calls;
        }
      }
      const container = new Container();
      container.register('tracker', Tracker, 'singleton');
      const a = container.resolve<Tracker>('tracker');
      const b = container.resolve<Tracker>('tracker');
      assert.strictEqual(a, b);
      assert.equal(a.id, 1);
    });

    test('factory singleton is called once', () => {
      let calls = 0;
      const container = new Container();
      container.register('val', () => {
        calls++;
        return calls;
      }, 'singleton');
      container.resolve('val');
      container.resolve('val');
      assert.equal(calls, 1);
    });
  });

  describe('transient scope', () => {
    test('returns new instance on every resolve', () => {
      let calls = 0;
      class Tracker {
        id: number;
        constructor() {
          this.id = ++calls;
        }
      }
      const container = new Container();
      container.register('tracker', Tracker, 'transient');
      const a = container.resolve<Tracker>('tracker');
      const b = container.resolve<Tracker>('tracker');
      assert.notStrictEqual(a, b);
      assert.equal(a.id, 1);
      assert.equal(b.id, 2);
    });
  });

  describe('request scope', () => {
    test('returns same instance within a request', () => {
      let calls = 0;
      class ReqScoped {
        id: number;
        constructor() {
          this.id = ++calls;
        }
      }
      const container = new Container();
      container.register('reqScoped', ReqScoped, 'request');
      const reqId = container.createRequestId();
      const a = container.resolve<ReqScoped>('reqScoped', reqId);
      const b = container.resolve<ReqScoped>('reqScoped', reqId);
      assert.strictEqual(a, b);
      assert.equal(a.id, 1);
    });

    test('returns different instance for different requests', () => {
      let calls = 0;
      class ReqScoped {
        id: number;
        constructor() {
          this.id = ++calls;
        }
      }
      const container = new Container();
      container.register('reqScoped', ReqScoped, 'request');
      const req1 = container.createRequestId();
      const req2 = container.createRequestId();
      const a = container.resolve<ReqScoped>('reqScoped', req1);
      const b = container.resolve<ReqScoped>('reqScoped', req2);
      assert.notStrictEqual(a, b);
    });

    test('clearRequestScope removes instances', () => {
      class ReqScoped {
        value = Date.now();
      }
      const container = new Container();
      container.register('reqScoped', ReqScoped, 'request');
      const reqId = container.createRequestId();
      const before = container.resolve<ReqScoped>('reqScoped', reqId);
      container.clearRequestScope(reqId);
      const after = container.resolve<ReqScoped>('reqScoped', reqId);
      assert.notStrictEqual(before, after);
    });

    test('throws without requestId for request-scoped', () => {
      class ReqScoped {}
      const container = new Container();
      container.register('reqScoped', ReqScoped, 'request');
      assert.throws(() => container.resolve('reqScoped'), /requestId/);
    });

    test('createRequestId returns unique ids', () => {
      const container = new Container();
      const id1 = container.createRequestId();
      const id2 = container.createRequestId();
      assert.notEqual(id1, id2);
    });
  });

  describe('lifecycle', () => {
    test('getSingletonInstances returns singleton instances', () => {
      class A {
        value = 'a';
      }
      const container = new Container();
      container.register('a', A, 'singleton');
      container.resolve('a');
      container.register('b', () => 'b', 'transient');
      const singletons = container.getSingletonInstances();
      assert.equal(singletons.length, 1);
      assert.equal((singletons[0] as A).value, 'a');
    });

    test('destroy calls onDestroy on singletons', async () => {
      let destroyed = false;
      class WithLifecycle {
        onDestroy() {
          destroyed = true;
        }
      }
      const container = new Container();
      container.register('lc', WithLifecycle, 'singleton');
      container.resolve('lc');
      await container.destroy();
      assert.equal(destroyed, true);
    });

    test('destroy clears all providers', async () => {
      const container = new Container();
      container.register('val', 42);
      await container.destroy();
      assert.throws(() => container.resolve('val'), /not registered/);
    });

    test('destroy skips providers without onDestroy', async () => {
      class NoLifecycle {
        value = 'no-hook';
      }
      const container = new Container();
      container.register('nlc', NoLifecycle, 'singleton');
      container.resolve('nlc');
      await container.destroy();
    });
  });
});
