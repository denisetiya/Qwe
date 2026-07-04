import { extname } from 'node:path';
import type { UploadedFile } from './file.js';

export class FileTypeFilter {
  private _allowedMimes: Set<string> | null = null;
  private _deniedMimes: Set<string> | null = null;
  private _allowedExts: Set<string> | null = null;
  private _deniedExts: Set<string> | null = null;

  allowMime(...mimes: string[]): this {
    if (!this._allowedMimes) this._allowedMimes = new Set();
    for (const m of mimes) this._allowedMimes.add(m.toLowerCase());
    return this;
  }

  denyMime(...mimes: string[]): this {
    if (!this._deniedMimes) this._deniedMimes = new Set();
    for (const m of mimes) this._deniedMimes.add(m.toLowerCase());
    return this;
  }

  allowExtension(...exts: string[]): this {
    if (!this._allowedExts) this._allowedExts = new Set();
    for (const e of exts) this._allowedExts.add(e.toLowerCase().replace(/^\./, ''));
    return this;
  }

  denyExtension(...exts: string[]): this {
    if (!this._deniedExts) this._deniedExts = new Set();
    for (const e of exts) this._deniedExts.add(e.toLowerCase().replace(/^\./, ''));
    return this;
  }

  test(file: UploadedFile): boolean {
    const mime = file.mimetype.toLowerCase();
    const ext = extname(file.filename).toLowerCase().replace(/^\./, '');

    if (this._deniedMimes?.has(mime)) return false;
    if (this._allowedMimes && !this._allowedMimes.has(mime)) return false;
    if (this._deniedExts?.has(ext)) return false;
    if (this._allowedExts && !this._allowedExts.has(ext)) return false;

    return true;
  }

  build(): (file: UploadedFile) => boolean {
    return (file) => this.test(file);
  }
}

export function createFilter(configure: (filter: FileTypeFilter) => void): (file: UploadedFile) => boolean {
  const filter = new FileTypeFilter();
  configure(filter);
  return filter.build();
}
