import { DEFAULT_COMPRESSION_THRESHOLD } from '../constants.js';

const NON_COMPRESSIBLE_PREFIXES = [
  'video/',
  'audio/',
  'image/',
];

const NON_COMPRESSIBLE_TYPES = new Set([
  'application/zip',
  'application/gzip',
  'application/x-tar',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'application/pdf',
  'application/wasm',
  'application/octet-stream',
  'image/svg+xml',
]);

export interface ThresholdConfig {
  minSize?: number;
  additionalTypes?: string[];
}

export class CompressionThreshold {
  readonly minSize: number;
  private readonly skipTypes: Set<string>;

  constructor(opts: ThresholdConfig = {}) {
    this.minSize = opts.minSize ?? DEFAULT_COMPRESSION_THRESHOLD;
    this.skipTypes = new Set(NON_COMPRESSIBLE_TYPES);
    if (opts.additionalTypes) {
      for (const t of opts.additionalTypes) {
        this.skipTypes.add(t);
      }
    }
  }

  shouldCompress(size: number, contentType: string): boolean {
    if (size < this.minSize) return false;
    return !this.isNonCompressible(contentType);
  }

  private isNonCompressible(contentType: string): boolean {
    const type = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
    if (this.skipTypes.has(type)) return true;
    for (const prefix of NON_COMPRESSIBLE_PREFIXES) {
      if (type.startsWith(prefix)) return true;
    }
    return false;
  }
}
