import type { ExecutionContext } from 'qwe';

export const loggingInterceptor = (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
  const start = performance.now();
  return next().then(() => {
    const duration = (performance.now() - start).toFixed(2);
    console.log(`${ctx.request.method} ${ctx.request.url} - ${duration}ms`);
  });
};
