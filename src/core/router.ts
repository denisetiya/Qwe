export type Guard = (ctx: unknown) => boolean | Promise<boolean>;
export type Interceptor = (ctx: unknown, next: () => Promise<void>) => void | Promise<void>;
export type Filter = (err: unknown, ctx: unknown) => void | Promise<void>;
export type Middleware = (ctx: unknown, next: () => Promise<void>) => void | Promise<void>;

export interface RouteHandler {
  controllerToken: string;
  methodName: string;
}

export interface RouteDefinition {
  method: string;
  path: string;
  handler: RouteHandler;
  guards: Guard[];
  interceptors: Interceptor[];
  filters: Filter[];
  meta: Record<string, unknown>;
}
