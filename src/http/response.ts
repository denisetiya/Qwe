import type * as uws from 'uWebSockets.js';

export interface QweResponse {
  _res: uws.HttpResponse;
  _statusCode: number;
  _headers: Record<string, string | string[]>;
  _sent: boolean;
  _aborted: boolean;

  status(code: number): QweResponse;
  header(name: string, value: string | string[]): QweResponse;
  removeHeader(name: string): QweResponse;
  getHeader(name: string): string | string[] | undefined;
  json(data: unknown): void;
  send(data: string | Buffer): void;
  text(data: string): void;
  html(data: string): void;
  ok(data?: unknown): void;
  created(data?: unknown): void;
  noContent(): void;
  redirect(url: string, code?: number): void;
  stream(stream: NodeJS.ReadableStream, contentType?: string): void;
  setCookie(name: string, value: string, opts?: CookieOptions): QweResponse;
  clearCookie(name: string): QweResponse;
  vary(field: string): QweResponse;
  cacheControl(directive: string): QweResponse;
  aborted(): boolean;
  onAborted(cb: () => void): void;
}

export interface CookieOptions {
  maxAge?: number;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

function formatCookie(name: string, value: string, opts?: CookieOptions): string {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  if (opts) {
    if (opts.maxAge !== undefined) cookie += `; Max-Age=${opts.maxAge}`;
    if (opts.path) cookie += `; Path=${opts.path}`;
    if (opts.domain) cookie += `; Domain=${opts.domain}`;
    if (opts.secure) cookie += '; Secure';
    if (opts.httpOnly) cookie += '; HttpOnly';
    if (opts.sameSite) cookie += `; SameSite=${opts.sameSite.charAt(0).toUpperCase() + opts.sameSite.slice(1)}`;
  }
  return cookie;
}

function writeHeaders(
  res: uws.HttpResponse,
  status: number,
  headers: Record<string, string | string[]>,
): void {
  res.writeStatus(String(status));
  for (const [key, value] of Object.entries(headers)) {
    res.writeHeader(key, Array.isArray(value) ? value.join(',') : value);
  }
}

// Optimize: Cache JSON serialization for repeated responses (max 100 entries)
const JSON_CACHE_SIZE = 100;
const jsonCache = new Map<unknown, string>();

function cachedJsonStringify(data: unknown): string {
  // Try to find in cache first
  const cached = jsonCache.get(data);
  if (cached !== undefined) {
    return cached;
  }
  
  // Stringify and cache
  const result = JSON.stringify(data);
  
  // Evict oldest entry if cache is full
  if (jsonCache.size >= JSON_CACHE_SIZE) {
    const firstKey = jsonCache.keys().next().value;
    if (firstKey !== undefined) {
      jsonCache.delete(firstKey);
    }
  }
  
  // Only cache objects (not primitives) for better hit rate
  if (typeof data === 'object' && data !== null) {
    jsonCache.set(data, result);
  }
  
  return result;
}

// Optimize: Reusable response class (avoid creating closures on every request)
class QweResponseImpl implements QweResponse {
  _res: uws.HttpResponse;
  _statusCode: number = 200;
  _headers: Record<string, string | string[]> = {};
  _sent: boolean = false;
  _aborted: boolean = false;

  constructor(res: uws.HttpResponse) {
    this._res = res;
    res.onAborted(() => {
      this._aborted = true;
    });
  }

  status(code: number): QweResponse {
    this._statusCode = code;
    return this;
  }

  header(name: string, value: string | string[]): QweResponse {
    this._headers[name] = value;
    return this;
  }

  removeHeader(name: string): QweResponse {
    delete this._headers[name];
    return this;
  }

  getHeader(name: string): string | string[] | undefined {
    return this._headers[name];
  }

  json(data: unknown): void {
    if (this._sent || this._aborted) return;
    this._sent = true;
    const body = cachedJsonStringify(data);
    writeHeaders(this._res, this._statusCode, this._headers);
    this._res.writeHeader('Content-Type', 'application/json; charset=utf-8');
    this._res.end(body);
  }

  send(data: string | Buffer): void {
    if (this._sent || this._aborted) return;
    this._sent = true;
    writeHeaders(this._res, this._statusCode, this._headers);
    if (typeof data === 'string' && !this._headers['Content-Type'] && !this._headers['content-type']) {
      this._res.writeHeader('Content-Type', 'text/plain; charset=utf-8');
    }
    this._res.end(data);
  }

  text(data: string): void {
    if (this._sent || this._aborted) return;
    this._sent = true;
    writeHeaders(this._res, this._statusCode, this._headers);
    this._res.writeHeader('Content-Type', 'text/plain; charset=utf-8');
    this._res.end(data);
  }

  html(data: string): void {
    if (this._sent || this._aborted) return;
    this._sent = true;
    writeHeaders(this._res, this._statusCode, this._headers);
    this._res.writeHeader('Content-Type', 'text/html; charset=utf-8');
    this._res.end(data);
  }

  ok(data?: unknown): void {
    this._statusCode = 200;
    if (data !== undefined) {
      this.json(data);
    } else {
      if (this._sent || this._aborted) return;
      this._sent = true;
      this._res.writeStatus('200');
      this._res.end();
    }
  }

  created(data?: unknown): void {
    this._statusCode = 201;
    if (data !== undefined) {
      this.json(data);
    } else {
      if (this._sent || this._aborted) return;
      this._sent = true;
      this._res.writeStatus('201');
      this._res.end();
    }
  }

  noContent(): void {
    if (this._sent || this._aborted) return;
    this._sent = true;
    this._res.writeStatus('204');
    this._res.end();
  }

  redirect(url: string, code = 302): void {
    if (this._sent || this._aborted) return;
    this._sent = true;
    this._statusCode = code;
    this._res.writeStatus(String(code));
    this._res.writeHeader('Location', url);
    this._res.end();
  }

  stream(stream: NodeJS.ReadableStream, contentType = 'application/octet-stream'): void {
    if (this._sent || this._aborted) return;
    this._sent = true;
    writeHeaders(this._res, this._statusCode, this._headers);
    this._res.writeHeader('Content-Type', contentType);

    let paused = false;
    stream.on('data', (chunk: Buffer) => {
      const ab = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
      const [ok] = this._res.tryEnd(ab, -1);
      if (!ok && !paused) {
        paused = true;
        stream.pause();
        this._res.onWritable(() => {
          paused = false;
          stream.resume();
          return true;
        });
      }
    });
    stream.on('end', () => {
      if (!this._aborted) this._res.end();
    });
    stream.on('error', () => {
      if (!this._aborted) this._res.end();
    });
  }

  setCookie(name: string, value: string, opts?: CookieOptions): QweResponse {
    const existing = this._headers['Set-Cookie'] || [];
    const arr = Array.isArray(existing) ? existing : [existing];
    arr.push(formatCookie(name, value, opts));
    this._headers['Set-Cookie'] = arr;
    return this;
  }

  clearCookie(name: string): QweResponse {
    return this.setCookie(name, '', { maxAge: 0 });
  }

  vary(field: string): QweResponse {
    const existing = this._headers['Vary'];
    if (existing) {
      const current = Array.isArray(existing) ? existing : [existing];
      this._headers['Vary'] = [...current, field];
    } else {
      this._headers['Vary'] = field;
    }
    return this;
  }

  cacheControl(directive: string): QweResponse {
    this._headers['Cache-Control'] = directive;
    return this;
  }

  aborted(): boolean {
    return this._aborted;
  }

  onAborted(cb: () => void): void {
    this._res.onAborted(cb);
  }
}

export function createQweResponse(res: uws.HttpResponse): QweResponse {
  return new QweResponseImpl(res);
}
