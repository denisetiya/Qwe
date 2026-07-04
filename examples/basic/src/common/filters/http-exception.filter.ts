import type { ExecutionContext } from 'qwe';
import { HttpException, QweValidationError } from 'qwe';

export const httpExceptionFilter = (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
  return next().then(
    () => {},
    (err: unknown) => {
      if (err instanceof HttpException) {
        ctx.response.status(err.status).json({
          success: false,
          error: err.message,
          code: err.code,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (err instanceof QweValidationError) {
        ctx.response.status(422).json({
          success: false,
          error: err.message,
          details: err.errors,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const message = err instanceof Error ? err.message : 'Internal Server Error';
      ctx.response.status(500).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      });
    },
  );
};
