import type * as uws from 'uWebSockets.js';

export interface ParsedUrl {
  pathname: string;
  search: string;
}

export interface QweRequest {
  method: string;
  url: string;
  path: string;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
  cookies: Record<string, string>;
  ip: string;
  hostname: string;
  startTime: number;
  _raw?: uws.HttpRequest;
  _queryParsed?: boolean;
  _cookiesParsed?: boolean;
  _rawQuery?: string;
  _rawCookies?: string;

  get(key: string): string | string[] | undefined;
  header(name: string): string | undefined;
  param(name: string): string | undefined;
  queryParam(name: string): string | string[] | undefined;
  cookie(name: string): string | undefined;
  accepts(type: string): boolean;
  is(type: string): boolean;
}

function parseQuery(search: string): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  if (!search) return query;

  const pairs = search.slice(1).split('&');
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!;
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) {
      query[decodeURIComponent(pair)] = '';
    } else {
      const key = decodeURIComponent(pair.slice(0, eqIdx));
      const value = decodeURIComponent(pair.slice(eqIdx + 1));
      const existing = query[key];
      if (existing === undefined) {
        query[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        query[key] = [existing, value];
      }
    }
  }
  return query;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(';');
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!.trim();
    const eq = pair.indexOf('=');
    if (eq > 0) {
      cookies[pair.slice(0, eq).trim()] = decodeURIComponent(pair.slice(eq + 1).trim());
    }
  }
  return cookies;
}

export function parseUrl(url: string): ParsedUrl {
  const qIdx = url.indexOf('?');
  if (qIdx === -1) {
    return { pathname: url, search: '' };
  }
  return { pathname: url.slice(0, qIdx), search: url.slice(qIdx) };
}

export function createQweRequest(
  method: string,
  url: string,
  params: Record<string, string>,
  headers: Record<string, string>,
  startTime: number,
  raw?: uws.HttpRequest,
): QweRequest {
  const { pathname, search } = parseUrl(url);
  
  // Optimize: Lazy-parse query and cookies
  const req: QweRequest = {
    method,
    url,
    path: pathname,
    query: {},
    params,
    headers,
    body: null,
    cookies: {},
    ip: headers['x-forwarded-for']?.split(',')[0]?.trim() ?? headers['x-real-ip'] ?? '',
    hostname: headers.host?.split(':')[0] ?? '',
    startTime,
    _raw: raw,
    _queryParsed: false,
    _cookiesParsed: false,
    _rawQuery: search,
    _rawCookies: headers.cookie,

    get(key: string): string | string[] | undefined {
      return req.headers[key.toLowerCase()];
    },

    header(name: string): string | undefined {
      return req.headers[name.toLowerCase()];
    },

    param(name: string): string | undefined {
      return req.params[name];
    },

    queryParam(name: string): string | string[] | undefined {
      // Lazy parse query on first access
      if (!req._queryParsed && req._rawQuery) {
        req.query = parseQuery(req._rawQuery);
        req._queryParsed = true;
      }
      return req.query[name];
    },

    cookie(name: string): string | undefined {
      // Lazy parse cookies on first access
      if (!req._cookiesParsed && req._rawCookies) {
        req.cookies = parseCookies(req._rawCookies);
        req._cookiesParsed = true;
      }
      return req.cookies[name];
    },

    accepts(type: string): boolean {
      const accept = req.headers.accept ?? '';
      if (!accept || accept === '*/*') return true;
      return accept.includes(type) || accept.includes('*/*');
    },

    is(type: string): boolean {
      const contentType = (req.headers['content-type'] ?? '').toLowerCase();
      return contentType.includes(type.toLowerCase());
    },
  };

  // Eagerly parse query if it exists (most requests have query params)
  if (search) {
    req.query = parseQuery(search);
    req._queryParsed = true;
  }

  return req;
}
