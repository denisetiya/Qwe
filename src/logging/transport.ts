import { createWriteStream, renameSync, statSync } from 'node:fs';
import type { WriteStream } from 'node:fs';

export interface LogTransport {
  write(line: string): void;
  close(): void;
}

export class ConsoleTransport implements LogTransport {
  write(line: string): void {
    process.stdout.write(line + '\n');
  }

  close(): void {}
}

export interface FileTransportOptions {
  path: string;
  maxSize?: number;
  maxFiles?: number;
}

export class FileTransport implements LogTransport {
  private stream: WriteStream;
  private currentSize = 0;
  private readonly path: string;
  private readonly maxSize: number;
  private readonly maxFiles: number;

  constructor(opts: FileTransportOptions) {
    this.path = opts.path;
    this.maxSize = opts.maxSize ?? 10 * 1024 * 1024;
    this.maxFiles = opts.maxFiles ?? 5;

    try {
      const stats = statSync(this.path);
      this.currentSize = stats.size;
    } catch {
      this.currentSize = 0;
    }

    this.stream = createWriteStream(this.path, { flags: 'a' });
  }

  write(line: string): void {
    const data = line + '\n';
    const len = Buffer.byteLength(data);

    if (this.currentSize + len > this.maxSize) {
      this.rotate();
    }

    this.stream.write(data);
    this.currentSize += len;
  }

  private rotate(): void {
    this.stream.end();

    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const older = `${this.path}.${i - 1}`;
      const newer = `${this.path}.${i}`;
      try {
        renameSync(older, newer);
      } catch {
        /* file may not exist */
      }
    }

    try {
      renameSync(this.path, `${this.path}.0`);
    } catch {
      /* file may not exist */
    }

    this.currentSize = 0;
    this.stream = createWriteStream(this.path, { flags: 'a' });
  }

  close(): void {
    this.stream.end();
  }
}

export interface StreamTransportOptions {
  stream: NodeJS.WritableStream;
}

export class StreamTransport implements LogTransport {
  private readonly stream: NodeJS.WritableStream;

  constructor(opts: StreamTransportOptions) {
    this.stream = opts.stream;
  }

  write(line: string): void {
    this.stream.write(line + '\n');
  }

  close(): void {
    if ('end' in this.stream && typeof this.stream.end === 'function') {
      (this.stream as NodeJS.WritableStream).end();
    }
  }
}

export interface MultiTransportOptions {
  transports: LogTransport[];
}

export class MultiTransport implements LogTransport {
  private readonly transports: LogTransport[];

  constructor(opts: MultiTransportOptions) {
    this.transports = opts.transports;
  }

  write(line: string): void {
    for (const t of this.transports) {
      t.write(line);
    }
  }

  close(): void {
    for (const t of this.transports) {
      t.close();
    }
  }
}
