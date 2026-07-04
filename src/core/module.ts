import type { ModuleDefinition } from './metadata.js';
import type { RouteDefinition, Guard, Interceptor, Filter } from './router.js';
import type { Container } from './container.js';
import { SCOPE_SINGLETON } from '../constants.js';

type Scope = 'singleton' | 'transient' | 'request';

interface RouteEntry {
  method: string;
  path: string;
  controllerClass: Function;
  methodName: string;
  guards: Guard[];
  interceptors: Interceptor[];
  filters: Filter[];
  meta: Record<string, unknown>;
  validate?: unknown;
}

export class RouterBuilder {
  private routes: RouteEntry[] = [];
  private guards: Guard[] = [];
  private interceptors: Interceptor[] = [];
  private filters: Filter[] = [];

  get(path: string, controller: Function, method: string, meta?: Record<string, unknown>): this {
    return this._add('GET', path, controller, method, meta);
  }

  post(path: string, controller: Function, method: string, meta?: Record<string, unknown>): this {
    return this._add('POST', path, controller, method, meta);
  }

  put(path: string, controller: Function, method: string, meta?: Record<string, unknown>): this {
    return this._add('PUT', path, controller, method, meta);
  }

  patch(path: string, controller: Function, method: string, meta?: Record<string, unknown>): this {
    return this._add('PATCH', path, controller, method, meta);
  }

  delete(path: string, controller: Function, method: string, meta?: Record<string, unknown>): this {
    return this._add('DELETE', path, controller, method, meta);
  }

  head(path: string, controller: Function, method: string, meta?: Record<string, unknown>): this {
    return this._add('HEAD', path, controller, method, meta);
  }

  options(path: string, controller: Function, method: string, meta?: Record<string, unknown>): this {
    return this._add('OPTIONS', path, controller, method, meta);
  }

  any(path: string, controller: Function, method: string, meta?: Record<string, unknown>): this {
    return this._add('ANY', path, controller, method, meta);
  }

  useGuard(guard: Guard): this {
    this.guards.push(guard);
    return this;
  }

  useInterceptor(interceptor: Interceptor): this {
    this.interceptors.push(interceptor);
    return this;
  }

  useFilter(filter: Filter): this {
    this.filters.push(filter);
    return this;
  }

  build(): RouteEntry[] {
    return this.routes.map((r) => ({
      ...r,
      guards: [...this.guards, ...r.guards],
      interceptors: [...this.interceptors, ...r.interceptors],
      filters: [...this.filters, ...r.filters],
    }));
  }

  private _add(method: string, path: string, controllerClass: Function, methodName: string, meta?: Record<string, unknown>): this {
    this.routes.push({
      method,
      path,
      controllerClass,
      methodName,
      guards: [],
      interceptors: [],
      filters: [],
      meta: meta || {},
    });
    return this;
  }
}

export class ModuleBuilder {
  private name: string;
  private controllers: Map<string, Function> = new Map();
  private providers: Map<string, { factory: unknown; scope: string }> = new Map();
  private routeEntries: RouteEntry[] = [];
  private moduleImports: ModuleDefinition[] = [];
  private globalGuards: Guard[] = [];
  private globalInterceptors: Interceptor[] = [];
  private globalFilters: Filter[] = [];

  constructor(name: string) {
    this.name = name;
  }

  controller(controllerClass: Function): this {
    this.controllers.set(controllerClass.name, controllerClass);
    return this;
  }

  provider(token: string, factory: unknown, scope: Scope = SCOPE_SINGLETON): this {
    this.providers.set(token, { factory, scope });
    return this;
  }

  router(prefix: string, configure: (rb: RouterBuilder) => void): this {
    const rb = new RouterBuilder();
    configure(rb);
    const entries = rb.build();
    for (const entry of entries) {
      entry.path = prefix + entry.path;
      this.routeEntries.push(entry);
    }
    return this;
  }

  import(moduleDef: ModuleDefinition): this {
    this.moduleImports.push(moduleDef);
    return this;
  }

  useGuard(guard: Guard): this {
    this.globalGuards.push(guard);
    return this;
  }

  useInterceptor(interceptor: Interceptor): this {
    this.globalInterceptors.push(interceptor);
    return this;
  }

  useFilter(filter: Filter): this {
    this.globalFilters.push(filter);
    return this;
  }

  build(): ModuleDefinition {
    const routes: RouteDefinition[] = this.routeEntries.map((entry) => ({
      method: entry.method,
      path: entry.path,
      handler: {
        controllerToken: entry.controllerClass.name,
        methodName: entry.methodName,
      },
      guards: entry.guards,
      interceptors: entry.interceptors,
      filters: entry.filters,
      meta: {
        ...entry.meta,
        validate: entry.validate,
      },
    }));

    return {
      name: this.name,
      controllers: this.controllers,
      providers: this.providers,
      routes,
      globalGuards: this.globalGuards,
      globalInterceptors: this.globalInterceptors,
      globalFilters: this.globalFilters,
      imports: this.moduleImports,
    };
  }
}

export function createModule(name: string, configure: (mod: ModuleBuilder) => void): ModuleDefinition {
  const builder = new ModuleBuilder(name);
  configure(builder);
  return builder.build();
}

export function installModule(container: Container, moduleDef: ModuleDefinition): void {
  for (const [token, { factory, scope }] of moduleDef.providers) {
    container.register(token, factory, scope as 'singleton' | 'transient' | 'request');
  }

  for (const [token, Ctor] of moduleDef.controllers) {
    container.register(token, Ctor, 'transient');
  }

  for (const imp of moduleDef.imports) {
    installModule(container, imp);
  }
}
