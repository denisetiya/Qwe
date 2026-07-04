import type { ExecutionContext, Guard } from '../../http/context.js';
import type { JWTPayload } from '../../security/jwt.js';
import { JwtService } from '../jwt.js';

export type TokenExtractor = (ctx: ExecutionContext) => string | null;

export interface JwtStrategyOptions {
  jwtService: JwtService;
  extractors?: TokenExtractor[];
  attachTo?: string;
}

export function extractFromHeader(headerName = 'authorization', prefix = 'Bearer'): TokenExtractor {
  const prefixLower = prefix.toLowerCase();
  return (ctx: ExecutionContext): string | null => {
    const value = ctx.request.header(headerName);
    if (!value) return null;
    if (prefix && value.toLowerCase().startsWith(prefixLower + ' ')) {
      return value.slice(prefix.length + 1).trim();
    }
    return value;
  };
}

export function extractFromCookie(cookieName = 'token'): TokenExtractor {
  return (ctx: ExecutionContext): string | null => {
    return ctx.request.cookie(cookieName) ?? null;
  };
}

export function extractFromQuery(paramName = 'token'): TokenExtractor {
  return (ctx: ExecutionContext): string | null => {
    const value = ctx.request.queryParam(paramName);
    if (typeof value === 'string') return value;
    return null;
  };
}

export class JwtStrategy {
  private extractors: TokenExtractor[];
  private jwtService: JwtService;
  private attachKey: string;

  constructor(options: JwtStrategyOptions) {
    this.jwtService = options.jwtService;
    this.attachKey = options.attachTo ?? 'user';
    this.extractors = options.extractors ?? [
      extractFromHeader(),
      extractFromCookie(),
    ];
  }

  extract(ctx: ExecutionContext): JWTPayload | null {
    for (const extractor of this.extractors) {
      const token = extractor(ctx);
      if (!token) continue;
      const payload = this.jwtService.verify(token);
      if (payload) return payload;
    }
    return null;
  }

  guard(): Guard {
    return (ctx: ExecutionContext): boolean => {
      const payload = this.extract(ctx);
      if (!payload) return false;
      (ctx.request as unknown as Record<string, unknown>)[this.attachKey] = payload;
      return true;
    };
  }

  optionalGuard(): Guard {
    return (ctx: ExecutionContext): boolean => {
      const payload = this.extract(ctx);
      if (payload) {
        (ctx.request as unknown as Record<string, unknown>)[this.attachKey] = payload;
      }
      return true;
    };
  }
}
