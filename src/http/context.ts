import type { QweRequest } from './request.js';
import type { QweResponse } from './response.js';
import type { Container } from '../core/container.js';

export interface ExecutionContext {
  request: QweRequest;
  response: QweResponse;
  requestId: string;
  container: Container;
  startTime: number;
  route?: {
    handler: HandlerRef;
    params: Record<string, string>;
    meta?: Record<string, unknown>;
  };
}

export interface HandlerRef {
  controllerToken: string;
  methodName: string;
}

export type Guard = (ctx: ExecutionContext) => boolean | Promise<boolean>;
export type Interceptor = (ctx: ExecutionContext, next: () => Promise<void>) => void | Promise<void>;
export type Filter = (err: unknown, ctx: ExecutionContext) => void | Promise<void>;
export type Middleware = (ctx: ExecutionContext, next: () => Promise<void>) => void | Promise<void>;
