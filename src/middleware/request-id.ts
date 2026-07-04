import { randomUUID } from 'crypto';

export interface RequestIdOptions {
  headerName?: string;
  generator?: () => string;
}

export function requestIdMiddleware(options: RequestIdOptions = {}) {
  const { headerName = 'X-Request-Id', generator = randomUUID } = options;

  return async (ctx: any, next: () => Promise<void>) => {
    const existingId = ctx.request.headers[headerName.toLowerCase()];
    const requestId = existingId || generator();

    ctx.request.requestId = requestId;
    ctx.requestId = requestId;

    ctx.response.header(headerName, requestId);

    await next();
  };
}
