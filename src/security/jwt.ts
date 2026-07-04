import * as crypto from 'crypto';

export interface JWTOptions {
  secret: string;
  algorithm?: 'HS256' | 'HS384' | 'HS512';
  expiresIn?: number;
  issuer?: string;
  audience?: string;
}

export interface JWTPayload {
  [key: string]: any;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export function signJWT(payload: JWTPayload, options: JWTOptions): string {
  const { secret, algorithm = 'HS256', expiresIn, issuer, audience } = options;

  const header = {
    alg: algorithm,
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const finalPayload: JWTPayload = {
    ...payload,
    iat: now,
  };

  if (expiresIn) {
    finalPayload.exp = now + expiresIn;
  }
  if (issuer) {
    finalPayload.iss = issuer;
  }
  if (audience) {
    finalPayload.aud = audience;
  }

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(finalPayload));

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64');

  const signatureB64 = base64UrlEncode(Buffer.from(signature, 'base64'));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export function verifyJWT(token: string, secret: string, options: Omit<JWTOptions, 'secret'> = {}): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return null;
    }

    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64');

    const expectedSignatureB64 = base64UrlEncode(Buffer.from(signature, 'base64'));

    if (signatureB64 !== expectedSignatureB64) {
      return null;
    }

    const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadB64));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    if (options.issuer && payload.iss !== options.issuer) {
      return null;
    }

    if (options.audience && payload.aud !== options.audience) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payloadB64 = parts[1];
    if (!payloadB64) {
      return null;
    }
    return JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }
}

function base64UrlEncode(str: string | Buffer): string {
  const buffer = typeof str === 'string' ? Buffer.from(str) : str;
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  while (base64.length % 4) {
    base64 += '=';
  }

  return Buffer.from(base64, 'base64').toString('utf8');
}
