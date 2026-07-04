import { gzipSync } from 'node:zlib';

export function compressGzip(input: Buffer): Buffer {
  return gzipSync(input);
}
