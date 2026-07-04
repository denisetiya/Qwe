import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RouterBuilder, createModule, installModule } from './module.js';
import { Container } from './container.js';

describe('RouterBuilder', () => {
  class TestController {
    list() {}
    create() {}
    getOne() {}
    update() {}
    remove() {}
  }

  test('builds GET routes', () => {
    const rb = new RouterBuilder();
    rb.get('/items', TestController, 'list');
    const routes = rb.build();
    assert.equal(routes.length, 1);
    assert.equal(routes[0]!.method, 'GET');
    assert.equal(routes[0]!.path, '/items');
    assert.equal(routes[0]!.methodName, 'list');
    assert.equal(routes[0]!.controllerClass, TestController);
  });

  test('builds POST routes', () => {
    const rb = new RouterBuilder();
    rb.post('/items', TestController, 'create');
    const routes = rb.build();
    assert.equal(routes[0]!.method, 'POST');
  });

  test('builds PUT routes', () => {
    const rb = new RouterBuilder();
    rb.put('/items/:id', TestController, 'update');
    const routes = rb.build();
    assert.equal(routes[0]!.method, 'PUT');
    assert.equal(routes[0]!.path, '/items/:id');
  });

  test('builds PATCH routes', () => {
    const rb = new RouterBuilder();
    rb.patch('/items/:id', TestController, 'update');
    assert.equal(rb.build()[0]!.method, 'PATCH');
  });

  test('builds DELETE routes', () => {
    const rb = new RouterBuilder();
    rb.delete('/items/:id', TestController, 'remove');
    assert.equal(rb.build()[0]!.method, 'DELETE');
  });

  test('builds multiple routes', () => {
    const rb = new RouterBuilder();
    rb.get('/items', TestController, 'list');
    rb.post('/items', TestController, 'create');
    rb.get('/items/:id', TestController, 'getOne');
    rb.put('/items/:id', TestController, 'update');
    rb.delete('/items/:id', TestController, 'remove');
    assert.equal(rb.build().length, 5);
  });

  test('applies guards to all routes', () => {
    const guard = () => true;
    const rb = new RouterBuilder();
    rb.useGuard(guard);
    rb.get('/a', TestController, 'list');
    rb.post('/a', TestController, 'create');
    const routes = rb.build();
    assert.equal(routes[0]!.guards.length, 1);
    assert.strictEqual(routes[0]!.guards[0], guard);
    assert.ok(routes[1]!.guards.includes(guard));
  });

  test('applies interceptors to all routes', () => {
    const interceptor = async (_ctx: unknown, next: () => Promise<void>) => next();
    const rb = new RouterBuilder();
    rb.useInterceptor(interceptor);
    rb.get('/a', TestController, 'list');
    const routes = rb.build();
    assert.equal(routes[0]!.interceptors.length, 1);
  });

  test('preserves meta on routes', () => {
    const rb = new RouterBuilder();
    rb.get('/items', TestController, 'list', { public: true });
    const routes = rb.build();
    assert.deepEqual(routes[0]!.meta, { public: true });
  });

  test('fluent API chaining', () => {
    const guard = () => true;
    const interceptor = async (_ctx: unknown, next: () => Promise<void>) => next();
    const routes = new RouterBuilder()
      .useGuard(guard)
      .useInterceptor(interceptor)
      .get('/a', TestController, 'list')
      .post('/a', TestController, 'create')
      .build();
    assert.equal(routes.length, 2);
    assert.equal(routes[0]!.guards.length, 1);
  });
});

describe('ModuleBuilder', () => {
  class TestService {
    getData() {
      return 'data';
    }
  }

  class TestController {
    constructor(_testService: TestService) {}
    list() {}
  }

  test('builds a module with providers and controllers', () => {
    const mod = createModule('test', (mb) => {
      mb.provider('testService', TestService);
      mb.controller(TestController);
    });
    assert.equal(mod.name, 'test');
    assert.equal(mod.providers.size, 1);
    assert.equal(mod.controllers.size, 1);
    assert.ok(mod.providers.has('testService'));
    assert.ok(mod.controllers.has('TestController'));
  });

  test('builds a module with routes', () => {
    const mod = createModule('test', (mb) => {
      mb.controller(TestController);
      mb.router('/api', (rb) => {
        rb.get('/items', TestController, 'list');
      });
    });
    assert.equal(mod.routes.length, 1);
    assert.equal(mod.routes[0]!.path, '/api/items');
    assert.equal(mod.routes[0]!.method, 'GET');
  });

  test('applies prefix to all routes', () => {
    const mod = createModule('test', (mb) => {
      mb.controller(TestController);
      mb.router('/v1', (rb) => {
        rb.get('/a', TestController, 'list');
        rb.get('/b', TestController, 'list');
      });
    });
    assert.equal(mod.routes[0]!.path, '/v1/a');
    assert.equal(mod.routes[1]!.path, '/v1/b');
  });

  test('registers module-level guards', () => {
    const guard = () => true;
    const mod = createModule('test', (mb) => {
      mb.useGuard(guard);
    });
    assert.equal(mod.globalGuards.length, 1);
  });

  test('registers module-level interceptors', () => {
    const interceptor = async (_ctx: unknown, next: () => Promise<void>) => next();
    const mod = createModule('test', (mb) => {
      mb.useInterceptor(interceptor);
    });
    assert.equal(mod.globalInterceptors.length, 1);
  });

  test('imports other modules', () => {
    const childModule = createModule('child', (mb) => {
      mb.provider('childService', TestService);
    });
    const parentModule = createModule('parent', (mb) => {
      mb.import(childModule);
    });
    assert.equal(parentModule.imports.length, 1);
    assert.equal(parentModule.imports[0]!.name, 'child');
  });

  test('provider scope defaults to singleton', () => {
    const mod = createModule('test', (mb) => {
      mb.provider('svc', TestService);
    });
    const provider = mod.providers.get('svc')!;
    assert.equal(provider.scope, 'singleton');
  });

  test('provider scope can be set to transient', () => {
    const mod = createModule('test', (mb) => {
      mb.provider('svc', TestService, 'transient');
    });
    const provider = mod.providers.get('svc')!;
    assert.equal(provider.scope, 'transient');
  });
});

describe('installModule', () => {
  test('registers providers and controllers in container', () => {
    class Svc {
      value = 42;
    }
    class Ctrl {
      handler() {}
    }
    const mod = createModule('test', (mb) => {
      mb.provider('svc', Svc);
      mb.controller(Ctrl);
    });
    const container = new Container();
    installModule(container, mod);
    const svc = container.resolve<Svc>('svc');
    assert.equal(svc.value, 42);
    const ctrl = container.resolve<Ctrl>('Ctrl');
    assert.ok(ctrl);
  });

  test('installs imported modules recursively', () => {
    class ChildSvc {
      value = 'child';
    }
    class ParentSvc {
      value = 'parent';
    }
    const childModule = createModule('child', (mb) => {
      mb.provider('childSvc', ChildSvc);
    });
    const parentModule = createModule('parent', (mb) => {
      mb.provider('parentSvc', ParentSvc);
      mb.import(childModule);
    });
    const container = new Container();
    installModule(container, parentModule);
    assert.equal(container.resolve<ChildSvc>('childSvc').value, 'child');
    assert.equal(container.resolve<ParentSvc>('parentSvc').value, 'parent');
  });
});
