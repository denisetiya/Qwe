import { HttpStatus } from '../http/status.js';

export interface ErrorHandlerOptions {
  debug?: boolean;
  logError?: boolean;
}

export function errorHandlerMiddleware(options: ErrorHandlerOptions = {}) {
  const { debug = false, logError = true } = options;

  return async (ctx: any, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error: any) {
      if (logError) {
        console.error('[qwe] Error:', error);
      }

      const status = error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.message || 'Internal Server Error';

      const body: any = {
        success: false,
        error: {
          message: debug ? message : (status >= 500 ? 'Internal Server Error' : message),
          code: error.code,
        },
      };

      if (debug && error.stack) {
        body.error.stack = error.stack;
      }

      ctx.response.status(status).json(body);
    }
  };
}
