import type { ExecutionContext, Middleware } from '../http/context.js';
import type { Logger } from './logger.js';

export function requestLoggingMiddleware(logger: Logger): Middleware {
  return async (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
    const start = performance.now();
    const req = ctx.request;

    const reqLogger = logger.child({
      requestId: ctx.requestId,
      module: 'http',
    });

    reqLogger.info(`${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      ip: req.ip,
    });

    try {
      await next();
    } finally {
      const duration = Math.round((performance.now() - start) * 100) / 100;
      const status = ctx.response._statusCode;

      reqLogger.info(`${req.method} ${req.url} ${status} ${duration}ms`, {
        method: req.method,
        url: req.url,
        status,
        duration,
      });
    }
  };
}
