export { JwtService, type JwtConfig, type TokenPair, type DecodedToken } from './jwt.js';
export {
  validatePasswordStrength,
  hash,
  compare,
  assertValid,
  type PasswordStrengthResult,
  type PasswordStrengthOptions,
} from './password.js';
export {
  createAuthGuard,
  createOptionalGuard,
  getUser,
  type GuardOptions,
} from './guard.js';
export {
  JwtStrategy,
  extractFromHeader,
  extractFromCookie,
  extractFromQuery,
  type TokenExtractor,
  type JwtStrategyOptions,
} from './strategies/jwt.strategy.js';
