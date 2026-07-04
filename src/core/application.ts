import { Container } from './container.js';
import type { ModuleDefinition } from './metadata.js';
import { installModule, createModule, ModuleBuilder } from './module.js';
import { RadixRouter } from '../http/radix-router.js';
import { QweServer, type ServerConfig } from '../http/server.js';
import type { Guard, Interceptor, Middleware } from '../http/context.js';
import { callHook } from './lifecycle.js';
import { Metadata } from './metadata.js';
import { VERSION } from '../constants.js';

export interface AppConfig {
  port?: number;
  host?: string;
  sslKeyFile?: string;
  sslCertFile?: string;
  strictRouting?: boolean;
  caseSensitive?: boolean;
}

export class QweApplication {
  private container: Container;
  private router: RadixRouter;
  private server: QweServer | null = null;
  private modules: ModuleDefinition[] = [];
  private globalMiddleware: Middleware[] = [];
  private globalGuards: Guard[] = [];
  private globalInterceptors: Interceptor[] = [];
  private _started = false;

  constructor(private config: AppConfig = {}) {
    this.container = new Container();
    this.router = new RadixRouter();
  }

  module(configure: (mod: ModuleBuilder) => void): this {
    const mod = createModule(`mod_${this.modules.length}`, configure);
    this.modules.push(mod);
    Metadata.register(mod.name, mod);
    return this;
  }

  addModule(moduleDef: ModuleDefinition): this {
    this.modules.push(moduleDef);
    Metadata.register(moduleDef.name, moduleDef);
    return this;
  }

  use(middleware: Middleware): this {
    this.globalMiddleware.push(middleware);
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

  async listen(port?: number, host?: string): Promise<void> {
    for (const mod of this.modules) {
      installModule(this.container, mod);
    }

    for (const mod of this.modules) {
      for (const route of mod.routes) {
        const guards = [...this.globalGuards, ...mod.globalGuards, ...route.guards];
        const interceptors = [...this.globalInterceptors, ...mod.globalInterceptors, ...route.interceptors];
        const meta = {
          ...route.meta,
          guards,
          interceptors,
          filters: route.filters,
        };
        this.router.add(route.method, route.path, route.handler, meta);
      }
    }

    for (const singleton of this.container.getSingletonInstances()) {
      await callHook(singleton, 'onInit');
    }

    const serverConfig: ServerConfig = {
      port: port ?? this.config.port ?? 3000,
      host: host ?? this.config.host ?? '0.0.0.0',
      sslKeyFile: this.config.sslKeyFile,
      sslCertFile: this.config.sslCertFile,
    };

    this.server = new QweServer(serverConfig, this.router, this.container);

    for (const mw of this.globalMiddleware) {
      this.server.addMiddleware(mw);
    }

    for (const guard of this.globalGuards) {
      this.server.addGlobalGuard(guard);
    }

    for (const interceptor of this.globalInterceptors) {
      this.server.addGlobalInterceptor(interceptor);
    }

    this._started = true;
    await this.server.listen();
  }

  async close(): Promise<void> {
    if (this.server) {
      await this.server.close();
    }
    for (const singleton of this.container.getSingletonInstances()) {
      await callHook(singleton, 'onDestroy');
    }
    await this.container.destroy();
    Metadata.clear();
  }

  getContainer(): Container {
    return this.container;
  }

  getRouter(): RadixRouter {
    return this.router;
  }

  getRoutes(): Array<{ method: string; path: string; meta?: Record<string, unknown> }> {
    return this.router.getAllRoutes();
  }

  isReady(): boolean {
    return this._started;
  }
}

export function createApplication(config?: AppConfig): QweApplication {
  return new QweApplication(config);
}

export { VERSION };
export { Container } from './container.js';
export { ModuleBuilder, RouterBuilder, createModule, installModule } from './module.js';
export { Metadata, type ModuleDefinition } from './metadata.js';
export type { Guard, Interceptor, Filter, Middleware } from './router.js';
export type { RouteHandler, RouteDefinition } from './router.js';
export { RadixRouter } from '../http/radix-router.js';
export { QweServer } from '../http/server.js';
export type { ServerConfig } from '../http/server.js';
export type { ExecutionContext } from '../http/context.js';
export type { QweRequest } from '../http/request.js';
export type { QweResponse, CookieOptions } from '../http/response.js';
export { HttpStatus } from '../http/status.js';
export type { HttpStatusCode } from '../http/status.js';
export { HTTP_METHODS } from '../http/methods.js';
export type { HttpMethod } from '../http/methods.js';
export type { WithLifecycle, LifecycleHook } from './lifecycle.js';
