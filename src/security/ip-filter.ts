import type { ExecutionContext, Middleware } from '../http/context.js';

interface CidrEntry {
  network: number;
  mask: number;
}

function parseIp(ip: string): number | null {
  const cleaned = ip.includes(':') ? extractIpv4FromIpv6(ip) : ip;
  const parts = cleaned.split('.');
  if (parts.length !== 4) return null;

  let result = 0;
  for (let i = 0; i < 4; i++) {
    const octet = Number(parts[i]);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    result = ((result << 8) | octet) >>> 0;
  }
  return result;
}

function extractIpv4FromIpv6(ip: string): string {
  const lastColon = ip.lastIndexOf(':');
  const possibleV4 = ip.slice(lastColon + 1);
  if (possibleV4.includes('.')) return possibleV4;
  return ip;
}

function parseCidr(cidr: string): CidrEntry | null {
  const slashIdx = cidr.indexOf('/');
  if (slashIdx === -1) {
    const ip = parseIp(cidr.trim());
    if (ip === null) return null;
    return { network: ip, mask: 0xFFFFFFFF };
  }

  const ipPart = cidr.slice(0, slashIdx).trim();
  const prefixLen = Number(cidr.slice(slashIdx + 1));
  if (!Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;

  const ip = parseIp(ipPart);
  if (ip === null) return null;

  const mask = prefixLen === 0 ? 0 : ((0xFFFFFFFF << (32 - prefixLen)) >>> 0);
  return {
    network: (ip & mask) >>> 0,
    mask,
  };
}

function ipMatchesCidr(ip: number, entry: CidrEntry): boolean {
  return ((ip & entry.mask) >>> 0) === entry.network;
}

export class IpFilterBuilder {
  private _allowlist: string[] = [];
  private _blocklist: string[] = [];
  private _message = 'Forbidden';

  allow(...ips: string[]): this {
    this._allowlist.push(...ips);
    return this;
  }

  block(...ips: string[]): this {
    this._blocklist.push(...ips);
    return this;
  }

  message(msg: string): this {
    this._message = msg;
    return this;
  }

  build(): Middleware {
    const allowEntries: CidrEntry[] = [];
    const blockEntries: CidrEntry[] = [];

    for (const cidr of this._allowlist) {
      const entry = parseCidr(cidr);
      if (entry) allowEntries.push(entry);
    }
    for (const cidr of this._blocklist) {
      const entry = parseCidr(cidr);
      if (entry) blockEntries.push(entry);
    }

    const hasAllowlist = allowEntries.length > 0;
    const hasBlocklist = blockEntries.length > 0;
    const message = this._message;

    return async (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
      const clientIp = ctx.request.ip || ctx.request.headers['x-forwarded-for'] || '';
      const ipNum = parseIp(clientIp);

      if (ipNum === null) {
        if (hasAllowlist) {
          ctx.response.status(403).json({
            success: false,
            error: message,
          });
          return;
        }
        await next();
        return;
      }

      if (hasBlocklist) {
        for (const entry of blockEntries) {
          if (ipMatchesCidr(ipNum, entry)) {
            ctx.response.status(403).json({
              success: false,
              error: message,
            });
            return;
          }
        }
      }

      if (hasAllowlist) {
        let matched = false;
        for (const entry of allowEntries) {
          if (ipMatchesCidr(ipNum, entry)) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          ctx.response.status(403).json({
            success: false,
            error: message,
          });
          return;
        }
      }

      await next();
    };
  }
}

export function ipFilter(configure?: (builder: IpFilterBuilder) => void): Middleware {
  const builder = new IpFilterBuilder();
  if (configure) configure(builder);
  return builder.build();
}
