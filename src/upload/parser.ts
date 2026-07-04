import type { UploadLimits } from './limits.js';
import { DEFAULT_UPLOAD_LIMITS } from './limits.js';
import { UploadedFile } from './file.js';

export interface ParsedField {
  name: string;
  value: string;
}

export interface ParseResult {
  fields: ParsedField[];
  files: UploadedFile[];
}

export class MultipartParseError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'MultipartParseError';
    this.code = code;
  }
}

const DOUBLE_CRLF = Buffer.from('\r\n\r\n');

function extractBoundary(contentType: string): string | null {
  const match = /boundary=(?:"([^"]+)"|([^\s;]+))/i.exec(contentType);
  return match ? (match[1] ?? match[2] ?? null) : null;
}

function parseContentDisposition(header: string): { name: string; filename: string | null } | null {
  const nameMatch = /name="([^"]*?)"/i.exec(header);
  if (!nameMatch) return null;
  const filenameMatch = /filename="([^"]*?)"/i.exec(header);
  return {
    name: nameMatch[1]!,
    filename: filenameMatch ? filenameMatch[1]! : null,
  };
}

function parsePartHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = raw.split('\r\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    headers[key] = value;
  }
  return headers;
}

function bufferIndexOf(haystack: Buffer, needle: Buffer, start = 0): number {
  return haystack.indexOf(needle, start);
}

export class MultipartParser {
  private _limits: UploadLimits;

  constructor(limits?: Partial<UploadLimits>) {
    this._limits = { ...DEFAULT_UPLOAD_LIMITS, ...limits };
  }

  async parse(body: Buffer, contentType: string): Promise<ParseResult> {
    const boundary = extractBoundary(contentType);
    if (!boundary) {
      throw new MultipartParseError('Missing boundary in Content-Type', 'MISSING_BOUNDARY');
    }

    const boundaryBuf = Buffer.from(`--${boundary}`);

    const fields: ParsedField[] = [];
    const files: UploadedFile[] = [];

    let pos = bufferIndexOf(body, boundaryBuf);
    if (pos === -1) {
      throw new MultipartParseError('Boundary not found in body', 'INVALID_BODY');
    }

    pos += boundaryBuf.length;

    if (body[pos] === 0x2d && body[pos + 1] === 0x2d) {
      return { fields, files };
    }

    if (body[pos] === 0x0d && body[pos + 1] === 0x0a) {
      pos += 2;
    }

    let partCount = 0;

    while (pos < body.length) {
      partCount++;
      if (partCount > this._limits.parts) {
        throw new MultipartParseError('Parts limit exceeded', 'LIMIT_PARTS');
      }

      const headerEndIdx = bufferIndexOf(body, DOUBLE_CRLF, pos);
      if (headerEndIdx === -1) break;

      const rawHeaders = body.toString('utf8', pos, headerEndIdx);
      const headerLines = rawHeaders.split('\r\n');

      if (headerLines.length > this._limits.headerPairs) {
        throw new MultipartParseError('Header pairs limit exceeded', 'LIMIT_HEADER_PAIRS');
      }

      const headers = parsePartHeaders(rawHeaders);
      const contentStart = headerEndIdx + DOUBLE_CRLF.length;

      const nextBoundaryIdx = bufferIndexOf(body, boundaryBuf, contentStart);
      if (nextBoundaryIdx === -1) break;

      let contentEnd = nextBoundaryIdx;
      if (contentEnd >= 2 && body[contentEnd - 2] === 0x0d && body[contentEnd - 1] === 0x0a) {
        contentEnd -= 2;
      }

      const contentDisposition = headers['content-disposition'];
      if (!contentDisposition) {
        pos = nextBoundaryIdx + boundaryBuf.length;
        if (body[pos] === 0x0d && body[pos + 1] === 0x0a) pos += 2;
        continue;
      }

      const disposition = parseContentDisposition(contentDisposition);
      if (!disposition) {
        pos = nextBoundaryIdx + boundaryBuf.length;
        if (body[pos] === 0x0d && body[pos + 1] === 0x0a) pos += 2;
        continue;
      }

      if (disposition.name.length > this._limits.fieldNameLength) {
        throw new MultipartParseError('Field name length exceeded', 'LIMIT_FIELD_NAME');
      }

      const partData = body.subarray(contentStart, contentEnd);

      if (disposition.filename !== null) {
        if (files.length >= this._limits.files) {
          throw new MultipartParseError('Files limit exceeded', 'LIMIT_FILES');
        }
        if (partData.length > this._limits.fileSize) {
          throw new MultipartParseError(`File "${disposition.filename}" exceeds size limit`, 'LIMIT_FILE_SIZE');
        }

        const mimetype = headers['content-type'] || 'application/octet-stream';
        const fileBuffer = Buffer.from(partData);

        files.push(new UploadedFile({
          originalName: disposition.filename,
          mimetype,
          size: fileBuffer.length,
          buffer: fileBuffer,
          fieldName: disposition.name,
        }));
      } else {
        if (fields.length >= this._limits.fields) {
          throw new MultipartParseError('Fields limit exceeded', 'LIMIT_FIELDS');
        }
        if (partData.length > this._limits.fieldSize) {
          throw new MultipartParseError('Field size limit exceeded', 'LIMIT_FIELD_SIZE');
        }

        fields.push({
          name: disposition.name,
          value: partData.toString('utf8'),
        });
      }

      pos = nextBoundaryIdx + boundaryBuf.length;

      if (body[pos] === 0x2d && body[pos + 1] === 0x2d) {
        break;
      }

      if (body[pos] === 0x0d && body[pos + 1] === 0x0a) {
        pos += 2;
      }
    }

    return { fields, files };
  }
}
