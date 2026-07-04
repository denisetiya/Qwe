import { createHash } from 'node:crypto';
import type { ExecutionContext } from '../http/context.js';

export interface ETagOptions {
  weak?: boolean;
  maxSize?: number;
}

function generateETag(body: string | Buffer, weak: boolean): string {
  const content = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  const hash = createHash('sha1').update(content).digest('hex').slice(0, 27);
  const size = content.length.toString(16);
  const tag = `"${size}-${hash}"`;
  return weak ? `W/${tag}` : tag;
}

export function etag(options: ETagOptions = {}) {
  const weak = options.weak ?? true;
  const maxSize = options.maxSize ?? 1024 * 1024;

  return async (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
    await next();

    if (ctx.response._sent || ctx.response._statusCode >= 300) return;

    const method = ctx.request.method;
    if (method !== 'GET' && method !== 'HEAD') return;

    const currentHeaders = ctx.response._headers;
    const contentType = (currentHeaders['Content-Type'] || '').toString().toLowerCase();

    if (contentType.startsWith('audio/') ||
        contentType.startsWith('video/') ||
        contentType.startsWith('image/')) {
      return;
    }

    const existingETag = currentHeaders['ETag'];
    if (existingETag !== undefined) return;

    const rawBody = (ctx.response as any)._body;
    if (rawBody === undefined || rawBody === null) return;

    const bodyContent = typeof rawBody === 'string' ? rawBody : Buffer.isBuffer(rawBody) ? rawBody : null;
    if (!bodyContent) return;

    const length = Buffer.isBuffer(bodyContent) ? bodyContent.length : Buffer.byteLength(bodyContent);
    if (length > maxSize) return;

    const tag = generateETag(bodyContent, weak);
    ctx.response.header('ETag', tag);

    const ifNoneMatch = ctx.request.headers['if-none-match'];
    if (ifNoneMatch && ifNoneMatch === tag) {
      ctx.response.status(304);
      ctx.response.header('Content-Length', '0');
      ctx.response.send(Buffer.alloc(0));
    }
  };
}
