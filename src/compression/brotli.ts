import { brotliCompressSync } from 'node:zlib';

export function compressBrotli(input: Buffer): Buffer {
  return brotliCompressSync(input);
}
