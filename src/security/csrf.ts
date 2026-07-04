import { randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import type { ExecutionContext, Middleware } from '../http/context.js';

export interface CsrfOptions {
  cookieName: string;
  headerName: string;
  secret: string;
  cookieOptions: {
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
  methods: string[];
  tokenLength: number;
}

const DEFAULT_CSRF_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function generateToken(length: number): string {
  return randomBytes(length).toString('hex');
}

function createSignedToken(token: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(token);
  return `${token}.${hmac.digest('hex')}`;
}

function verifySignedToken(signedToken: string, secret: string): string | null {
  const dotIdx = signedToken.lastIndexOf('.');
  if (dotIdx === -1) return null;

  const token = signedToken.slice(0, dotIdx);
  const signature = signedToken.slice(dotIdx + 1);

  const expected = createHmac('sha256', secret).update(token).digest('hex');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');

  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  return token;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export class CsrfBuilder {
  private _cookieName = '_csrf';
  private _headerName = 'x-csrf-token';
  private _secret = '';
  private _cookiePath = '/';
  private _cookieHttpOnly = true;
  private _cookieSecure = true;
  private _cookieSameSite: 'strict' | 'lax' | 'none' = 'strict';
  private _methods: string[] = [...DEFAULT_CSRF_METHODS];
  private _tokenLength = 32;

  cookieName(name: string): this {
    this._cookieName = name;
    return this;
  }

  headerName(name: string): this {
    this._headerName = name;
    return this;
  }

  secret(secret: string): this {
    this._secret = secret;
    return this;
  }

  cookiePath(path: string): this {
    this._cookiePath = path;
    return this;
  }

  cookieHttpOnly(enabled: boolean): this {
    this._cookieHttpOnly = enabled;
    return this;
  }

  cookieSecure(enabled: boolean): this {
    this._cookieSecure = enabled;
    return this;
  }

  cookieSameSite(value: 'strict' | 'lax' | 'none'): this {
    this._cookieSameSite = value;
    return this;
  }

  methods(...methods: string[]): this {
    this._methods = methods;
    return this;
  }

  tokenLength(length: number): this {
    this._tokenLength = length;
    return this;
  }

  build(): Middleware {
    const cookieName = this._cookieName;
    const headerName = this._headerName;
    const secret = this._secret;
    const methods = new Set(this._methods);
    const tokenLength = this._tokenLength;
    const cookiePath = this._cookiePath;
    const cookieHttpOnly = this._cookieHttpOnly;
    const cookieSecure = this._cookieSecure;
    const cookieSameSite = this._cookieSameSite;

    if (!secret) {
      throw new Error('[qwe] CSRF: secret is required');
    }

    return async (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
      const existingCookie = ctx.request.cookies[cookieName];

      if (!existingCookie || !verifySignedToken(existingCookie, secret)) {
        const rawToken = generateToken(tokenLength);
        const signedToken = createSignedToken(rawToken, secret);

        ctx.response.setCookie(cookieName, signedToken, {
          path: cookiePath,
          httpOnly: cookieHttpOnly,
          secure: cookieSecure,
          sameSite: cookieSameSite,
        });
      }

      if (!methods.has(ctx.request.method)) {
        await next();
        return;
      }

      const cookieToken = ctx.request.cookies[cookieName];
      const headerToken = ctx.request.headers[headerName];

      if (!cookieToken || !headerToken) {
        ctx.response.status(403).json({
          success: false,
          error: 'CSRF token missing',
        });
        return;
      }

      const verifiedCookie = verifySignedToken(cookieToken, secret);
      if (!verifiedCookie) {
        ctx.response.status(403).json({
          success: false,
          error: 'CSRF token invalid',
        });
        return;
      }

      if (!timingSafeStringEqual(verifiedCookie, headerToken)) {
        ctx.response.status(403).json({
          success: false,
          error: 'CSRF token mismatch',
        });
        return;
      }

      await next();
    };
  }
}

export function csrf(configure: (builder: CsrfBuilder) => void): Middleware {
  const builder = new CsrfBuilder();
  configure(builder);
  return builder.build();
}

export { generateToken as generateCsrfToken };
