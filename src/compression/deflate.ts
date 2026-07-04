import { deflateSync } from 'node:zlib';

export function compressDeflate(input: Buffer): Buffer {
  return deflateSync(input);
}
