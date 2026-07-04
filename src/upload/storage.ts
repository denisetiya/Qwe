import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import type { UploadedFile } from './file.js';

export interface StorageEngine {
  save(file: UploadedFile): Promise<StoredFile>;
}

export interface StoredFile {
  path: string | null;
  buffer: Buffer;
  filename: string;
  size: number;
}

export class DiskStorage implements StorageEngine {
  private _destination: string;
  private _uniqueNames: boolean;

  constructor(destination: string, uniqueNames = true) {
    this._destination = destination;
    this._uniqueNames = uniqueNames;
  }

  async save(file: UploadedFile): Promise<StoredFile> {
    await mkdir(this._destination, { recursive: true });

    let filename: string;
    if (this._uniqueNames) {
      const unique = randomBytes(16).toString('hex');
      const ext = extname(file.filename);
      filename = `${unique}${ext}`;
    } else {
      filename = file.filename;
    }

    const filePath = join(this._destination, filename);
    await writeFile(filePath, file.buffer);

    return {
      path: filePath,
      buffer: file.buffer,
      filename,
      size: file.size,
    };
  }

  get destination(): string {
    return this._destination;
  }
}

export class MemoryStorage implements StorageEngine {
  async save(file: UploadedFile): Promise<StoredFile> {
    return {
      path: null,
      buffer: file.buffer,
      filename: file.filename,
      size: file.size,
    };
  }
}

export class StorageBuilder {
  private _engine: StorageEngine = new MemoryStorage();

  disk(destination: string, uniqueNames?: boolean): this {
    this._engine = new DiskStorage(destination, uniqueNames);
    return this;
  }

  memory(): this {
    this._engine = new MemoryStorage();
    return this;
  }

  custom(engine: StorageEngine): this {
    this._engine = engine;
    return this;
  }

  build(): StorageEngine {
    return this._engine;
  }
}

export function createStorage(configure?: (builder: StorageBuilder) => void): StorageEngine {
  const builder = new StorageBuilder();
  if (configure) configure(builder);
  return builder.build();
}
