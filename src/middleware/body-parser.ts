import type { ExecutionContext } from '../http/context.js';

export interface BodyParserOptions {
  jsonLimit?: number;
  urlencodedLimit?: number;
  strict?: boolean;
}

const DEFAULT_JSON_LIMIT = 1 * 1024 * 1024;
const DEFAULT_URLENCODED_LIMIT = 1 * 1024 * 1024;

function parseUrlEncoded(body: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const pairs = body.split('&');

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!;
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) {
      result[decodeURIComponent(pair)] = '';
    } else {
      const key = decodeURIComponent(pair.slice(0, eqIdx));
      const value = decodeURIComponent(pair.slice(eqIdx + 1));
      const existing = result[key];

      if (existing === undefined) {
        result[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    }
  }

  return result;
}

export function bodyParser(options: BodyParserOptions = {}) {
  const jsonLimit = options.jsonLimit ?? DEFAULT_JSON_LIMIT;
  const urlencodedLimit = options.urlencodedLimit ?? DEFAULT_URLENCODED_LIMIT;
  const strict = options.strict ?? true;

  return async (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
    const contentType = (ctx.request.headers['content-type'] || '').toLowerCase();
    const body = ctx.request.body;

    if (body === null || body === undefined) {
      await next();
      return;
    }

    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const bodyStr = typeof body === 'string' ? body : body.toString('utf8');

      if (contentType.includes('application/json')) {
        if (bodyStr.length > jsonLimit) {
          ctx.response.status(413).json({
            success: false,
            error: 'JSON payload too large',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        try {
          ctx.request.body = JSON.parse(bodyStr, strict ? undefined : undefined);
        } catch {
          ctx.response.status(400).json({
            success: false,
            error: 'Invalid JSON',
            timestamp: new Date().toISOString(),
          });
          return;
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        if (bodyStr.length > urlencodedLimit) {
          ctx.response.status(413).json({
            success: false,
            error: 'URL-encoded payload too large',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        ctx.request.body = parseUrlEncoded(bodyStr);
      }
    }

    await next();
  };
}
