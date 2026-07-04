import { Container } from '../core/container.js';
import type { ExecutionContext, Guard, Interceptor, Middleware } from '../http/context.js';

export interface MockContext {
  request: any;
  response: any;
  container: Container;
  requestId: string;
  state: Record<string, any>;
}

export function createMockContext(overrides: Partial<MockContext> = {}): ExecutionContext {
  const container = new Container();
  
  const ctx: ExecutionContext = {
    request: {
      method: 'GET',
      url: '/',
      path: '/',
      params: {},
      query: {},
      headers: {},
      body: null,
      ip: '127.0.0.1',
      startTime: Date.now(),
      ...overrides.request,
    },
    response: {
      json: (_data: any) => {},
      text: (_data: string) => {},
      status: (_code: number) => ({} as any),
      ok: (_data?: any) => {},
      created: (_data?: any) => {},
      ...overrides.response,
    },
    container: overrides.container ?? container,
    requestId: overrides.requestId ?? `test_${Date.now()}`,
    startTime: Date.now(),
    ...overrides,
  } as any;

  return ctx;
}

export interface MockController {
  [methodName: string]: (...args: any[]) => any;
}

export function createMockController(methods: MockController = {}): MockController {
  return { ...methods };
}

export function createMockService<T extends object>(methods: Partial<T> = {}): T {
  return methods as T;
}

export function createMockGuard(allowed = true): Guard {
  return () => allowed;
}

export function createMockInterceptor(fn?: (ctx: ExecutionContext, next: () => Promise<void>) => Promise<void>): Interceptor {
  return fn ?? (async (_ctx, next) => next());
}

export function createMockMiddleware(fn?: (ctx: ExecutionContext, next: () => Promise<void>) => Promise<void>): Middleware {
  return fn ?? (async (_ctx, next) => next());
}

export interface FixtureGenerator<T = any> {
  build: (overrides?: Partial<T>) => T;
  buildMany: (count: number, overrides?: Partial<T>) => T[];
}

export function createFixtureGenerator<T>(defaultValues: T): FixtureGenerator<T> {
  let counter = 0;

  return {
    build: (overrides?: Partial<T>) => {
      counter++;
      return { ...defaultValues, ...overrides, _id: counter } as T;
    },
    buildMany: (count: number, overrides?: Partial<T>) => {
      return Array.from({ length: count }, () => {
        counter++;
        return { ...defaultValues, ...overrides, _id: counter } as T;
      });
    },
  };
}

export function createTestContainer(): Container {
  return new Container();
}

export function mockProvider(container: Container, token: string, value: any): void {
  container.register(token, () => value);
}
