import type { ExecutionContext, Middleware } from '../http/context.js';

export interface CspOptions {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  connectSrc: string[];
  fontSrc: string[];
  objectSrc: string[];
  mediaSrc: string[];
  frameSrc: string[];
  childSrc: string[];
  workerSrc: string[];
  frameAncestors: string[];
  formAction: string[];
  baseUri: string[];
  reportUri: string;
}

export interface HelmetOptions {
  contentSecurityPolicy: Partial<CspOptions> | false;
  hsts: { maxAge: number; includeSubDomains: boolean; preload: boolean } | false;
  xContentTypeOptions: 'nosniff' | false;
  xFrameOptions: 'DENY' | 'SAMEORIGIN' | false;
  xXssProtection: string | false;
  referrerPolicy: string | false;
  crossOriginEmbedderPolicy: string | false;
  crossOriginOpenerPolicy: string | false;
  crossOriginResourcePolicy: string | false;
  originAgentCluster: boolean;
}

const DEFAULT_CSP: CspOptions = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'"],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
  childSrc: ["'self'"],
  workerSrc: ["'self'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  baseUri: ["'self'"],
  reportUri: '',
};

function buildCspHeader(csp: Partial<CspOptions>): string {
  const merged = { ...DEFAULT_CSP, ...csp };
  const directives: string[] = [];

  const mapping: [keyof CspOptions, string][] = [
    ['defaultSrc', 'default-src'],
    ['scriptSrc', 'script-src'],
    ['styleSrc', 'style-src'],
    ['imgSrc', 'img-src'],
    ['connectSrc', 'connect-src'],
    ['fontSrc', 'font-src'],
    ['objectSrc', 'object-src'],
    ['mediaSrc', 'media-src'],
    ['frameSrc', 'frame-src'],
    ['childSrc', 'child-src'],
    ['workerSrc', 'worker-src'],
    ['frameAncestors', 'frame-ancestors'],
    ['formAction', 'form-action'],
    ['baseUri', 'base-uri'],
  ];

  for (const [key, directive] of mapping) {
    const value = merged[key];
    if (Array.isArray(value) && value.length > 0) {
      directives.push(`${directive} ${value.join(' ')}`);
    }
  }

  if (merged.reportUri) {
    directives.push(`report-uri ${merged.reportUri}`);
  }

  return directives.join('; ');
}

export class HelmetBuilder {
  private _csp: Partial<CspOptions> | false = { ...DEFAULT_CSP };
  private _hsts: HelmetOptions['hsts'] = { maxAge: 31536000, includeSubDomains: true, preload: false };
  private _xContentTypeOptions: HelmetOptions['xContentTypeOptions'] = 'nosniff';
  private _xFrameOptions: HelmetOptions['xFrameOptions'] = 'DENY';
  private _xXssProtection: HelmetOptions['xXssProtection'] = '0';
  private _referrerPolicy: HelmetOptions['referrerPolicy'] = 'no-referrer';
  private _crossOriginEmbedderPolicy: HelmetOptions['crossOriginEmbedderPolicy'] = false;
  private _crossOriginOpenerPolicy: HelmetOptions['crossOriginOpenerPolicy'] = false;
  private _crossOriginResourcePolicy: HelmetOptions['crossOriginResourcePolicy'] = false;
  private _originAgentCluster = true;

  contentSecurityPolicy(opts: Partial<CspOptions>): this {
    this._csp = opts;
    return this;
  }

  disableCsp(): this {
    this._csp = false;
    return this;
  }

  hsts(maxAge: number, includeSubDomains = true, preload = false): this {
    this._hsts = { maxAge, includeSubDomains, preload };
    return this;
  }

  disableHsts(): this {
    this._hsts = false;
    return this;
  }

  xContentTypeOptions(value: 'nosniff' | false): this {
    this._xContentTypeOptions = value;
    return this;
  }

  xFrameOptions(value: 'DENY' | 'SAMEORIGIN' | false): this {
    this._xFrameOptions = value;
    return this;
  }

  xXssProtection(value: string | false): this {
    this._xXssProtection = value;
    return this;
  }

  referrerPolicy(value: string | false): this {
    this._referrerPolicy = value;
    return this;
  }

  crossOriginEmbedderPolicy(value: string): this {
    this._crossOriginEmbedderPolicy = value;
    return this;
  }

  crossOriginOpenerPolicy(value: string): this {
    this._crossOriginOpenerPolicy = value;
    return this;
  }

  crossOriginResourcePolicy(value: string): this {
    this._crossOriginResourcePolicy = value;
    return this;
  }

  originAgentCluster(enabled = true): this {
    this._originAgentCluster = enabled;
    return this;
  }

  build(): Middleware {
    const cspHeader = this._csp ? buildCspHeader(this._csp) : null;
    const hstsValue = this._hsts
      ? `max-age=${this._hsts.maxAge}${this._hsts.includeSubDomains ? '; includeSubDomains' : ''}${this._hsts.preload ? '; preload' : ''}`
      : null;

    return async (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
      const res = ctx.response;

      if (cspHeader) {
        res.header('Content-Security-Policy', cspHeader);
      }
      if (hstsValue) {
        res.header('Strict-Transport-Security', hstsValue);
      }
      if (this._xContentTypeOptions) {
        res.header('X-Content-Type-Options', this._xContentTypeOptions);
      }
      if (this._xFrameOptions) {
        res.header('X-Frame-Options', this._xFrameOptions);
      }
      if (this._xXssProtection !== false) {
        res.header('X-XSS-Protection', this._xXssProtection);
      }
      if (this._referrerPolicy) {
        res.header('Referrer-Policy', this._referrerPolicy);
      }
      if (this._crossOriginEmbedderPolicy) {
        res.header('Cross-Origin-Embedder-Policy', this._crossOriginEmbedderPolicy);
      }
      if (this._crossOriginOpenerPolicy) {
        res.header('Cross-Origin-Opener-Policy', this._crossOriginOpenerPolicy);
      }
      if (this._crossOriginResourcePolicy) {
        res.header('Cross-Origin-Resource-Policy', this._crossOriginResourcePolicy);
      }
      if (this._originAgentCluster) {
        res.header('Origin-Agent-Cluster', '?1');
      }

      await next();
    };
  }
}

export function helmet(configure?: (builder: HelmetBuilder) => void): Middleware {
  const builder = new HelmetBuilder();
  if (configure) configure(builder);
  return builder.build();
}
