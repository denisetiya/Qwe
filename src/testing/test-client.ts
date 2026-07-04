import type { ExecutionContext, Guard, Interceptor, Middleware } from '../http/context.js';
import type { Container } from '../core/container.js';
import { RadixRouter } from '../http/radix-router.js';

export interface TestResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: unknown;
  text: string;
  json: () => unknown;
}

export interface TestClient {
  get(path: string, options?: RequestOptions): Promise<TestResponse>;
  post(path: string, body?: unknown, options?: RequestOptions): Promise<TestResponse>;
  put(path: string, body?: unknown, options?: RequestOptions): Promise<TestResponse>;
  patch(path: string, body?: unknown, options?: RequestOptions): Promise<TestResponse>;
  delete(path: string, options?: RequestOptions): Promise<TestResponse>;
  head(path: string, options?: RequestOptions): Promise<TestResponse>;
  options(path: string, options?: RequestOptions): Promise<TestResponse>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export interface TestClientOptions {
  router: RadixRouter;
  container: Container;
  middleware?: Middleware[];
  guards?: Guard[];
  interceptors?: Interceptor[];
}

export function createTestClient(options: TestClientOptions): TestClient {
  const { router, container, middleware = [], guards = [], interceptors = [] } = options;

  async function makeRequest(
    method: string,
    path: string,
    body?: unknown,
    reqOptions?: RequestOptions,
  ): Promise<TestResponse> {
    let url = path;
    if (reqOptions?.query) {
      const queryStr = Object.entries(reqOptions.query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      url += `?${queryStr}`;
    }

    const pathOnly = url.split('?')[0] ?? '';
    const routeMatch = router.find(method, pathOnly);
    if (!routeMatch) {
      return createErrorResponse(404, { error: 'Not Found' });
    }

    const mockRequest: any = {
      method,
      url,
      path: pathOnly,
      params: routeMatch.params,
      query: parseQuery(url),
      headers: { ...reqOptions?.headers },
      body: body ?? null,
      ip: '127.0.0.1',
      startTime: Date.now(),
    };

    const mockResponse = new MockResponse();

    const ctx: ExecutionContext = {
      request: mockRequest,
      response: mockResponse as any,
      requestId: `test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      container,
      startTime: Date.now(),
      route: {
        handler: {
          controllerToken: routeMatch.handler.controllerToken,
          methodName: routeMatch.handler.methodName,
        },
        params: routeMatch.params,
        meta: routeMatch.meta,
      },
    };

    const allGuards = [...guards, ...((routeMatch.meta?.guards as Guard[]) || [])];
    for (const guard of allGuards) {
      const allowed = await Promise.resolve(guard(ctx));
      if (!allowed) {
        return createErrorResponse(403, { error: 'Forbidden' });
      }
    }

    const pipeline = [
      ...middleware,
      ...interceptors,
      ...((routeMatch.meta?.interceptors as Interceptor[]) || []),
    ];

    try {
      const handler: Interceptor = async (ctx, _next) => {
        const controller = ctx.container.resolve<any>(ctx.route!.handler.controllerToken);
        const handlerMethod = controller[ctx.route!.handler.methodName];
        if (typeof handlerMethod !== 'function') {
          throw new Error(`Method "${ctx.route!.handler.methodName}" not found`);
        }
        await handlerMethod.call(controller, ctx);
      };

      const executePipeline = async (idx: number): Promise<void> => {
        if (idx >= pipeline.length) {
          await handler(ctx, async () => {});
          return;
        }
        await pipeline[idx]!(ctx, async () => executePipeline(idx + 1));
      };

      await executePipeline(0);
    } catch (error) {
      return createErrorResponse(500, {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return mockResponse.getTestResponse();
  }

  return {
    get: (path, options) => makeRequest('GET', path, undefined, options),
    post: (path, body, options) => makeRequest('POST', path, body, options),
    put: (path, body, options) => makeRequest('PUT', path, body, options),
    patch: (path, body, options) => makeRequest('PATCH', path, body, options),
    delete: (path, options) => makeRequest('DELETE', path, undefined, options),
    head: (path, options) => makeRequest('HEAD', path, undefined, options),
    options: (path, options) => makeRequest('OPTIONS', path, undefined, options),
  };
}

class MockResponse {
  private _status = 200;
  private _headers: Record<string, string | string[]> = {};
  private _body: unknown = null;
  private _text = '';
  private _sent = false;

  status(code: number): MockResponse {
    this._status = code;
    return this;
  }

  header(name: string, value: string | string[]): MockResponse {
    this._headers[name.toLowerCase()] = value;
    return this;
  }

  json(data: unknown): void {
    if (this._sent) return;
    this._sent = true;
    this._body = data;
    this._text = JSON.stringify(data);
    this._headers['content-type'] = 'application/json';
  }

  text(data: string): void {
    if (this._sent) return;
    this._sent = true;
    this._body = data;
    this._text = data;
    this._headers['content-type'] = 'text/plain';
  }

  html(data: string): void {
    if (this._sent) return;
    this._sent = true;
    this._body = data;
    this._text = data;
    this._headers['content-type'] = 'text/html';
  }

  send(body: string | Buffer): void {
    if (this._sent) return;
    this._sent = true;
    if (typeof body === 'string') {
      this._body = body;
      this._text = body;
    } else {
      this._body = body.toString();
      this._text = body.toString();
    }
  }

  ok(data?: unknown): void {
    this._status = 200;
    if (data !== undefined) {
      this.json(data);
    } else {
      this.json({ success: true });
    }
  }

  created(data?: unknown): void {
    this._status = 201;
    if (data !== undefined) {
      this.json(data);
    } else {
      this.json({ success: true });
    }
  }

  noContent(): void {
    this._status = 204;
    this._sent = true;
  }

  redirect(url: string, code = 302): void {
    this._status = code;
    this.header('location', url);
    this._sent = true;
  }

  stream(_stream: NodeJS.ReadableStream, _contentType?: string): void {
    this._sent = true;
  }

  setCookie(_name: string, _value: string, _options?: unknown): MockResponse {
    return this;
  }

  clearCookie(_name: string): MockResponse {
    return this;
  }

  aborted(): boolean {
    return false;
  }

  onAborted(_cb: () => void): void {
    // No-op for testing
  }

  getTestResponse(): TestResponse {
    return {
      status: this._status,
      headers: this._headers,
      body: this._body,
      text: this._text,
      json: () => this._body,
    };
  }
}

function parseQuery(url: string): Record<string, string> {
  const queryStr = url.split('?')[1];
  if (!queryStr) return {};

  const result: Record<string, string> = {};
  const pairs = queryStr.split('&');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = decodeURIComponent(pair.slice(0, eqIdx));
    const value = decodeURIComponent(pair.slice(eqIdx + 1));
    result[key] = value;
  }
  return result;
}

function createErrorResponse(status: number, body: unknown): TestResponse {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body,
    text: JSON.stringify(body),
    json: () => body,
  };
}
