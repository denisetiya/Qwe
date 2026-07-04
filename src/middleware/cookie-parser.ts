import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ExecutionContext } from '../http/context.js';

export interface CookieParserOptions {
  secret?: string | string[];
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!.trim();
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const key = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      cookies[key] = decodeURIComponent(value);
    }
  }

  return cookies;
}

function unsignCookie(value: string, secret: string): string | false {
  const signaturePrefix = '.';
  const sigIdx = value.lastIndexOf(signaturePrefix);
  if (sigIdx === -1) return false;

  const payload = value.slice(0, sigIdx);
  const signature = value.slice(sigIdx + 1);

  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('base64');

  try {
    const sigBuf = Buffer.from(signature, 'base64');
    const expectedBuf = Buffer.from(expected, 'base64');
    if (sigBuf.length !== expectedBuf.length) return false;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return false;
  } catch {
    return false;
  }

  return payload;
}

export function cookieParser(options: CookieParserOptions = {}) {
  const secrets = options.secret
    ? Array.isArray(options.secret)
      ? options.secret
      : [options.secret]
    : [];

  return async (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
    const cookieHeader = ctx.request.headers['cookie'];
    if (!cookieHeader) {
      await next();
      return;
    }

    const cookies = parseCookies(cookieHeader);
    const unsigned: Record<string, string> = {};

    if (secrets.length > 0) {
      for (const [key, value] of Object.entries(cookies)) {
        let unsignResult: string | false = false;
        for (const secret of secrets) {
          unsignResult = unsignCookie(value, secret);
          if (unsignResult !== false) break;
        }
        if (unsignResult !== false) {
          unsigned[key] = unsignResult;
        } else {
          unsigned[key] = value;
        }
      }
      ctx.request.cookies = unsigned;
    } else {
      ctx.request.cookies = cookies;
    }

    await next();
  };
}
