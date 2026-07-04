import { DEFAULT_FILE_LIMIT } from '../constants.js';

export interface UploadLimits {
  fileSize: number;
  fileCount: number;
  fieldSize: number;
  fieldNameLength: number;
  fields: number;
  files: number;
  parts: number;
  headerPairs: number;
}

export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  fileSize: DEFAULT_FILE_LIMIT,
  fileCount: 10,
  fieldSize: 1024 * 1024,
  fieldNameLength: 128,
  fields: 50,
  files: 10,
  parts: 100,
  headerPairs: 50,
};

export class LimitsBuilder {
  private _limits: UploadLimits = { ...DEFAULT_UPLOAD_LIMITS };

  fileSize(bytes: number): this {
    this._limits.fileSize = bytes;
    return this;
  }

  fileCount(count: number): this {
    this._limits.fileCount = count;
    return this;
  }

  fieldSize(bytes: number): this {
    this._limits.fieldSize = bytes;
    return this;
  }

  fieldNameLength(length: number): this {
    this._limits.fieldNameLength = length;
    return this;
  }

  fields(count: number): this {
    this._limits.fields = count;
    return this;
  }

  files(count: number): this {
    this._limits.files = count;
    return this;
  }

  parts(count: number): this {
    this._limits.parts = count;
    return this;
  }

  headerPairs(count: number): this {
    this._limits.headerPairs = count;
    return this;
  }

  build(): UploadLimits {
    return { ...this._limits };
  }
}

export function createLimits(configure?: (builder: LimitsBuilder) => void): UploadLimits {
  const builder = new LimitsBuilder();
  if (configure) configure(builder);
  return builder.build();
}
