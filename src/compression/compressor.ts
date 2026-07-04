import type { ExecutionContext, Middleware } from '../http/context.js';
import { compressBrotli } from './brotli.js';
import { compressGzip } from './gzip.js';
import { compressDeflate } from './deflate.js';
import { CompressionThreshold } from './threshold.js';
import type { ThresholdConfig } from './threshold.js';

type Encoding = 'br' | 'gzip' | 'deflate';

function parseAcceptEncoding(header: string): Encoding | null {
  const lower = header.toLowerCase();
  if (lower.includes('br')) return 'br';
  if (lower.includes('gzip')) return 'gzip';
  if (lower.includes('deflate')) return 'deflate';
  return null;
}

function compress(data: Buffer, encoding: Encoding): Buffer {
  switch (encoding) {
    case 'br':
      return compressBrotli(data);
    case 'gzip':
      return compressGzip(data);
    case 'deflate':
      return compressDeflate(data);
  }
}

function findContentType(headers: Record<string, string | string[]>): string {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-type') {
      return Array.isArray(value) ? value[0] ?? '' : value;
    }
  }
  return '';
}

export interface CompressionOptions extends ThresholdConfig {}

export function compressionMiddleware(opts: CompressionOptions = {}): Middleware {
  const threshold = new CompressionThreshold(opts);

  return async (ctx: ExecutionContext, _next: () => Promise<void>): Promise<void> => {
    const acceptEncoding = ctx.request.headers['accept-encoding'] ?? '';
    const encoding = parseAcceptEncoding(acceptEncoding);

    if (!encoding) {
      await _next();
      return;
    }

    const res = ctx.response;
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalText = res.text.bind(res);
    const originalHtml = res.html.bind(res);

    const writeCompressed = (
      body: Buffer,
      contentType: string,
      original: () => void,
    ): void => {
      if (!threshold.shouldCompress(body.byteLength, contentType)) {
        original();
        return;
      }

      const compressed = compress(body, encoding);
      res.header('Content-Encoding', encoding);
      res.header('Vary', 'Accept-Encoding');
      originalSend(compressed);
    };

    const mutable = res as unknown as Record<string, (...args: never[]) => void>;

    mutable.json = (data: unknown): void => {
      const body = Buffer.from(JSON.stringify(data));
      writeCompressed(body, 'application/json; charset=utf-8', () => originalJson(data));
    };

    mutable.text = (data: string): void => {
      const body = Buffer.from(data);
      writeCompressed(body, 'text/plain; charset=utf-8', () => originalText(data));
    };

    mutable.html = (data: string): void => {
      const body = Buffer.from(data);
      writeCompressed(body, 'text/html; charset=utf-8', () => originalHtml(data));
    };

    mutable.send = (data: string | Buffer): void => {
      const body = typeof data === 'string' ? Buffer.from(data) : data;
      const contentType = findContentType(res._headers);
      writeCompressed(body, contentType, () => originalSend(data));
    };

    await _next();
  };
}
