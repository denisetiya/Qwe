export interface ResponseTimeOptions {
  headerName?: string;
  digits?: number;
}

export function responseTimeMiddleware(options: ResponseTimeOptions = {}) {
  const { headerName = 'X-Response-Time', digits = 2 } = options;

  return async (ctx: any, next: () => Promise<void>) => {
    const start = process.hrtime.bigint();

    await next();

    const diff = process.hrtime.bigint() - start;
    const ms = Number(diff) / 1_000_000;
    const time = ms.toFixed(digits);

    ctx.response.header(headerName, `${time}ms`);
  };
}
