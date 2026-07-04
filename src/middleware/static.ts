import { stat, open } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import type { ExecutionContext } from '../http/context.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
};

export interface StaticOptions {
  root: string;
  prefix?: string;
  cacheControl?: string;
  maxAge?: number;
  index?: string;
  hidden?: boolean;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  etagEnabled?: boolean;
}

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

function generateFileETag(size: number, mtime: Date): string {
  const hash = createHash('sha1')
    .update(`${size}-${mtime.getTime()}`)
    .digest('hex')
    .slice(0, 27);
  return `"${size.toString(16)}-${hash}"`;
}

function parseRangeHeader(range: string, size: number): { start: number; end: number } | null {
  const match = range.match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;

  let start = match[1] ? parseInt(match[1], 10) : 0;
  let end = match[2] ? parseInt(match[2], 10) : size - 1;

  if (match[1] === '') {
    start = size - parseInt(match[2]!, 10);
    end = size - 1;
  }

  if (start < 0) start = 0;
  if (end >= size) end = size - 1;
  if (start > end) return null;

  return { start, end };
}

export function serveStatic(options: StaticOptions) {
  const root = options.root;
  const prefix = options.prefix ?? '';
  const cacheControl = options.cacheControl ?? `public, max-age=${options.maxAge ?? 0}`;
  const indexFile = options.index ?? 'index.html';
  const dotfiles = options.dotfiles ?? 'ignore';
  const etagEnabled = options.etagEnabled ?? true;

  return async (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
    const method = ctx.request.method;
    if (method !== 'GET' && method !== 'HEAD') {
      await next();
      return;
    }

    let requestPath = ctx.request.path;
    if (prefix && requestPath.startsWith(prefix)) {
      requestPath = requestPath.slice(prefix.length);
    } else if (prefix && !requestPath.startsWith(prefix)) {
      await next();
      return;
    }

    if (!requestPath.startsWith('/')) {
      requestPath = '/' + requestPath;
    }

    const decodedPath = decodeURIComponent(requestPath).replace(/\\/g, '/');
    if (decodedPath.includes('..') || decodedPath.includes('\0')) {
      await next();
      return;
    }

    const segments = decodedPath.split('/').filter(Boolean);
    for (const seg of segments) {
      if (seg.startsWith('.')) {
        if (dotfiles === 'deny') {
          ctx.response.status(403).json({ success: false, error: 'Forbidden' });
          return;
        }
        if (dotfiles === 'ignore') {
          await next();
          return;
        }
      }
    }

    let filePath = join(root, ...segments);
    let statResult;

    try {
      statResult = await stat(filePath);
    } catch {
      await next();
      return;
    }

    if (statResult.isDirectory()) {
      filePath = join(filePath, indexFile);
      try {
        statResult = await stat(filePath);
      } catch {
        await next();
        return;
      }
    }

    if (!statResult.isFile()) {
      await next();
      return;
    }

    const mimeType = getMimeType(filePath);
    const size = statResult.size;
    const mtime = statResult.mtime;

    let etag: string | undefined;
    if (etagEnabled) {
      etag = generateFileETag(size, mtime);

      const ifNoneMatch = ctx.request.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        ctx.response.status(304);
        ctx.response.header('ETag', etag);
        ctx.response.header('Cache-Control', cacheControl);
        ctx.response.send(Buffer.alloc(0));
        return;
      }
    }

    const rangeHeader = ctx.request.headers['range'];
    if (rangeHeader) {
      const range = parseRangeHeader(rangeHeader, size);
      if (!range) {
        ctx.response.status(416);
        ctx.response.header('Content-Range', `bytes */${size}`);
        ctx.response.send(Buffer.alloc(0));
        return;
      }

      ctx.response.status(206);
      ctx.response.header('Content-Type', mimeType);
      ctx.response.header('Content-Length', String(range.end - range.start + 1));
      ctx.response.header('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
      ctx.response.header('Cache-Control', cacheControl);
      ctx.response.header('Last-Modified', mtime.toUTCString());
      if (etag) ctx.response.header('ETag', `W/${etag}`);
      ctx.response.header('Accept-Ranges', 'bytes');

      if (method === 'HEAD') {
        ctx.response.send(Buffer.alloc(0));
        return;
      }

      const fh = await open(filePath, 'r');
      try {
        const buffer = Buffer.alloc(range.end - range.start + 1);
        await fh.read(buffer, 0, buffer.length, range.start);
        ctx.response.send(buffer);
      } finally {
        await fh.close();
      }
      return;
    }

    ctx.response.header('Content-Type', mimeType);
    ctx.response.header('Content-Length', String(size));
    ctx.response.header('Cache-Control', cacheControl);
    ctx.response.header('Last-Modified', mtime.toUTCString());
    if (etag) ctx.response.header('ETag', `W/${etag}`);
    ctx.response.header('Accept-Ranges', 'bytes');

    if (method === 'HEAD') {
      ctx.response.send(Buffer.alloc(0));
      return;
    }

    const fh = await open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(size);
      await fh.read(buffer, 0, size, 0);
      ctx.response.send(buffer);
    } finally {
      await fh.close();
    }
  };
}
