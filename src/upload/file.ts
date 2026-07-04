import { createWriteStream } from 'node:fs';
import { basename, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const UNSAFE_CHARS = /[^\w\s.\-]/g;
const LEADING_DOTS = /^\.+/;
const MULTI_SPACES = /\s+/g;

function sanitizeFilename(name: string): string {
  let sanitized = basename(name);
  sanitized = sanitized.replace(UNSAFE_CHARS, '');
  sanitized = sanitized.replace(LEADING_DOTS, '');
  sanitized = sanitized.replace(MULTI_SPACES, ' ').trim();
  if (sanitized.length === 0) {
    sanitized = 'unnamed';
  }
  const ext = extname(sanitized);
  const base = sanitized.slice(0, sanitized.length - ext.length);
  const truncated = base.slice(0, 255 - ext.length);
  return truncated + ext;
}

export class UploadedFile {
  readonly filename: string;
  readonly originalName: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
  readonly fieldName: string;

  constructor(opts: {
    originalName: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
    fieldName: string;
  }) {
    this.originalName = opts.originalName;
    this.filename = sanitizeFilename(opts.originalName);
    this.mimetype = opts.mimetype;
    this.size = opts.size;
    this.buffer = opts.buffer;
    this.fieldName = opts.fieldName;
  }

  stream(): Readable {
    return Readable.from(this.buffer);
  }

  async save(destPath: string): Promise<void> {
    const ws = createWriteStream(destPath);
    await pipeline(this.stream(), ws);
  }

  get extension(): string {
    return extname(this.filename).toLowerCase();
  }
}
