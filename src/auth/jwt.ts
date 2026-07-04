import { signJWT, verifyJWT, decodeJWT, type JWTOptions, type JWTPayload } from '../security/jwt.js';
import { generateToken } from '../security/crypto.js';

export interface JwtConfig {
  secret: string;
  algorithm?: 'HS256' | 'HS384' | 'HS512';
  accessExpiresIn?: number;
  refreshExpiresIn?: number;
  issuer?: string;
  audience?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface DecodedToken {
  payload: JWTPayload;
  expired: boolean;
}

export class JwtService {
  constructor(private config: JwtConfig) {
    if (!config.secret) {
      throw new Error('JWT secret is required');
    }
    if (!config.accessExpiresIn) {
      this.config.accessExpiresIn = 900;
    }
    if (!config.refreshExpiresIn) {
      this.config.refreshExpiresIn = 604800;
    }
  }

  signAccessToken(payload: JWTPayload): string {
    return signJWT(payload, this._signOptions(this.config.accessExpiresIn!));
  }

  signRefreshToken(payload: JWTPayload): string {
    const refreshPayload: JWTPayload = {
      sub: payload.sub,
      type: 'refresh',
      jti: generateToken(16),
    };
    return signJWT(refreshPayload, this._signOptions(this.config.refreshExpiresIn!));
  }

  signPair(payload: JWTPayload): TokenPair {
    return {
      accessToken: this.signAccessToken(payload),
      refreshToken: this.signRefreshToken(payload),
      expiresIn: this.config.accessExpiresIn!,
    };
  }

  verify(token: string): JWTPayload | null {
    return verifyJWT(token, this.config.secret, {
      algorithm: this.config.algorithm,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  refresh(refreshToken: string): TokenPair | null {
    const payload = verifyJWT(refreshToken, this.config.secret);
    if (!payload) return null;
    if (payload.type !== 'refresh') return null;

    const accessTokenPayload: JWTPayload = { sub: payload.sub };
    return this.signPair(accessTokenPayload);
  }

  decode(token: string): DecodedToken | null {
    const payload = decodeJWT(token);
    if (!payload) return null;
    const now = Math.floor(Date.now() / 1000);
    return { payload, expired: payload.exp ? payload.exp < now : false };
  }

  private _signOptions(expiresIn: number): JWTOptions {
    return {
      secret: this.config.secret,
      algorithm: this.config.algorithm,
      expiresIn,
      issuer: this.config.issuer,
      audience: this.config.audience,
    };
  }
}
