import type { ExecutionContext, Guard } from '../http/context.js';
import type { JWTPayload } from '../security/jwt.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import type { JwtService } from './jwt.js';

export interface GuardOptions {
  jwtService: JwtService;
  attachTo?: string;
  requiredRoles?: string[];
  roleKey?: string;
}

export function createAuthGuard(options: GuardOptions): Guard {
  const strategy = new JwtStrategy({
    jwtService: options.jwtService,
    attachTo: options.attachTo,
  });

  const baseGuard = strategy.guard();

  if (!options.requiredRoles || options.requiredRoles.length === 0) {
    return baseGuard;
  }

  const roleKey = options.roleKey ?? 'role';
  const required = new Set(options.requiredRoles);

  return async (ctx: ExecutionContext): Promise<boolean> => {
    const allowed = await baseGuard(ctx);
    if (!allowed) return false;

    const user = (ctx.request as unknown as Record<string, unknown>)[options.attachTo ?? 'user'] as JWTPayload | undefined;
    if (!user) return false;

    const roles: unknown = user[roleKey];
    if (Array.isArray(roles)) {
      return roles.some((r) => required.has(String(r)));
    }
    if (typeof roles === 'string') {
      return required.has(roles);
    }
    return false;
  };
}

export function createOptionalGuard(options: GuardOptions): Guard {
  const strategy = new JwtStrategy({
    jwtService: options.jwtService,
    attachTo: options.attachTo,
  });
  return strategy.optionalGuard();
}

export function getUser(ctx: ExecutionContext, key = 'user'): JWTPayload | null {
  return ((ctx.request as unknown as Record<string, unknown>)[key] as JWTPayload) ?? null;
}
