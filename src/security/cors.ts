import type { ExecutionContext, Middleware } from '../http/context.js';

type OriginFn = (origin: string) => boolean;
type OriginValue = string | string[] | RegExp | RegExp[] | OriginFn | true;

export interface CorsOptions {
  origin: OriginValue;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
}

const DEFAULT_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];

function matchOrigin(requestOrigin: string, allowed: OriginValue): boolean {
  if (allowed === true) return true;
  if (typeof allowed === 'string') return requestOrigin === allowed;
  if (allowed instanceof RegExp) return allowed.test(requestOrigin);
  if (typeof allowed === 'function') return allowed(requestOrigin);
  if (Array.isArray(allowed)) {
    for (const item of allowed) {
      if (typeof item === 'string' && requestOrigin === item) return true;
      if (item instanceof RegExp && item.test(requestOrigin)) return true;
    }
  }
  return false;
}

export class CorsBuilder {
  private _origin: OriginValue = '*';
  private _methods: string[] = [...DEFAULT_METHODS];
  private _allowedHeaders: string[] = [];
  private _exposedHeaders: string[] = [];
  private _credentials = false;
  private _maxAge = 0;
  private _preflightContinue = false;

  origin(value: OriginValue): this {
    this._origin = value;
    return this;
  }

  methods(...methods: string[]): this {
    this._methods = methods;
    return this;
  }

  allowedHeaders(...headers: string[]): this {
    this._allowedHeaders = headers;
    return this;
  }

  exposedHeaders(...headers: string[]): this {
    this._exposedHeaders = headers;
    return this;
  }

  credentials(enabled = true): this {
    this._credentials = enabled;
    return this;
  }

  maxAge(seconds: number): this {
    this._maxAge = seconds;
    return this;
  }

  preflightContinue(enabled = true): this {
    this._preflightContinue = enabled;
    return this;
  }

  build(): Middleware {
    const opts: CorsOptions = {
      origin: this._origin,
      methods: this._methods,
      allowedHeaders: this._allowedHeaders,
      exposedHeaders: this._exposedHeaders,
      credentials: this._credentials,
      maxAge: this._maxAge,
      preflightContinue: this._preflightContinue,
    };

    return async (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
      const reqOrigin = ctx.request.headers['origin'] || '';
      const response = ctx.response;

      if (!reqOrigin) {
        await next();
        return;
      }

      const allowed = matchOrigin(reqOrigin, opts.origin);
      if (!allowed) {
        await next();
        return;
      }

      const vary = 'Origin';
      response.header('Vary', vary);

      if (opts.origin === true || typeof opts.origin === 'function') {
        response.header('Access-Control-Allow-Origin', reqOrigin);
      } else if (opts.origin === '*') {
        response.header('Access-Control-Allow-Origin', '*');
      } else {
        response.header('Access-Control-Allow-Origin', reqOrigin);
      }

      if (opts.credentials) {
        response.header('Access-Control-Allow-Credentials', 'true');
      }

      if (opts.exposedHeaders.length > 0) {
        response.header('Access-Control-Expose-Headers', opts.exposedHeaders.join(', '));
      }

      if (ctx.request.method === 'OPTIONS') {
        response.header('Access-Control-Allow-Methods', opts.methods.join(', '));

        const reqHeaders = ctx.request.headers['access-control-request-headers'];
        if (opts.allowedHeaders.length > 0) {
          response.header('Access-Control-Allow-Headers', opts.allowedHeaders.join(', '));
        } else if (reqHeaders) {
          response.header('Access-Control-Allow-Headers', reqHeaders);
          response.header('Vary', 'Origin, Access-Control-Request-Headers');
        }

        if (opts.maxAge > 0) {
          response.header('Access-Control-Max-Age', String(opts.maxAge));
        }

        if (!opts.preflightContinue) {
          response.status(204).send('');
          return;
        }
      }

      await next();
    };
  }
}

export function cors(configure?: (builder: CorsBuilder) => void): Middleware {
  const builder = new CorsBuilder();
  if (configure) configure(builder);
  return builder.build();
}
