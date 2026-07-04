import * as uws from 'uWebSockets.js';
import { RadixRouter, type RouteMatch } from './radix-router.js';
import { createQweRequest } from './request.js';
import { createQweResponse } from './response.js';
import type { ExecutionContext, Guard, Interceptor, Middleware } from './context.js';
import type { Container } from '../core/container.js';
import { HttpStatus } from './status.js';

export interface ServerConfig {
  port: number;
  host?: string;
  sslKeyFile?: string;
  sslCertFile?: string;
}

export class QweServer {
  private _app: uws.TemplatedApp;
  private _listenSocket: uws.us_listen_socket | null = null;
  private _config: ServerConfig;
  private _router: RadixRouter;
  private _container: Container;
  private _middleware: Middleware[] = [];
  private _globalGuards: Guard[] = [];
  private _globalInterceptors: Interceptor[] = [];

  constructor(config: ServerConfig, router: RadixRouter, container: Container) {
    this._config = config;
    this._router = router;
    this._container = container;

    if (config.sslKeyFile && config.sslCertFile) {
      this._app = uws.SSLApp({
        key_file_name: config.sslKeyFile,
        cert_file_name: config.sslCertFile,
      });
    } else {
      this._app = uws.App();
    }

    this._app.any('/*', this._handleRequest.bind(this));
  }

  addMiddleware(mw: Middleware): void {
    this._middleware.push(mw);
  }

  addGlobalGuard(guard: Guard): void {
    this._globalGuards.push(guard);
  }

  addGlobalInterceptor(interceptor: Interceptor): void {
    this._globalInterceptors.push(interceptor);
  }

  private _handleRequest(res: uws.HttpResponse, req: uws.HttpRequest): void {
    const method = req.getMethod().toUpperCase();
    const url = req.getUrl();
    const query = req.getQuery();
    const fullUrl = query ? `${url}?${query}` : url;
    const startTime = performance.now();

    // Optimize: Pre-lowercase headers (avoid repeated toLowerCase calls)
    const headers: Record<string, string> = {};
    req.forEach((key: string, value: string) => {
      headers[key.toLowerCase()] = value;
    });

    const routeMatch = this._router.find(method, url);
    const params = routeMatch?.params ?? {};

    // Fast path for GET/HEAD (no body parsing needed)
    if (method === 'GET' || method === 'HEAD') {
      this._executeRequest(method, fullUrl, headers, null, params, res, startTime, routeMatch);
      return;
    }

    // Body parsing for POST/PUT/PATCH/DELETE
    const bodyChunks: Buffer[] = [];
    let bodyAborted = false;
    let bodySize = 0;

    res.onAborted(() => {
      bodyAborted = true;
      bodyChunks.length = 0;
    });

    res.onData((chunk: ArrayBuffer, isLast: boolean) => {
      if (bodyAborted) return;
      
      const buffer = Buffer.from(chunk);
      bodyChunks.push(buffer);
      bodySize += buffer.length;
      
      // Early return if not last chunk
      if (!isLast) return;

      // Optimize: Only concat once when we have all data
      const body = bodySize > 0 ? Buffer.concat(bodyChunks, bodySize) : null;
      bodyChunks.length = 0; // Free memory early
      
      let parsedBody: unknown = null;
      if (body && body.length > 0) {
        const contentType = (headers['content-type'] ?? '').toLowerCase();
        
        // Optimize: Check JSON first (most common case)
        if (contentType.startsWith('application/json')) {
          try {
            parsedBody = JSON.parse(body.toString('utf8'));
          } catch {
            if (!bodyAborted) {
              res.writeStatus('400');
              res.end(JSON.stringify({
                success: false,
                error: 'Invalid JSON',
                timestamp: new Date().toISOString(),
              }));
            }
            return;
          }
        } else {
          parsedBody = body.toString('utf8');
        }
      }

      if (!bodyAborted) {
        this._executeRequest(method, url, headers, parsedBody, params, res, startTime, routeMatch);
      }
    });
  }

  private async _executeRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: unknown,
    params: Record<string, string>,
    res: uws.HttpResponse,
    startTime: number,
    routeMatch: RouteMatch | null,
  ): Promise<void> {
    if (!routeMatch) {
      res.writeStatus('404');
      res.writeHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: 'Not Found',
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    const qweReq = createQweRequest(method, url, params, headers, startTime);
    qweReq.body = body;
    const qweRes = createQweResponse(res);

    const ctx: ExecutionContext = {
      request: qweReq,
      response: qweRes,
      requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      container: this._container,
      startTime,
      route: {
        handler: {
          controllerToken: routeMatch.handler.controllerToken,
          methodName: routeMatch.handler.methodName,
        },
        params,
        meta: routeMatch.meta,
      },
    };

    try {
      const guards: Guard[] = [
        ...this._globalGuards,
        ...((routeMatch.meta?.guards as Guard[]) || []),
      ];
      for (const guard of guards) {
        const allowed = await Promise.resolve(guard(ctx));
        if (!allowed) {
          qweRes.status(HttpStatus.FORBIDDEN).json({
            success: false,
            error: 'Forbidden',
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const interceptors: Interceptor[] = [
        ...this._middleware,
        ...this._globalInterceptors,
        ...((routeMatch.meta?.interceptors as Interceptor[]) || []),
      ];

      const handler: Interceptor = async (ctx, _next) => {
        const token = ctx.route!.handler.controllerToken;
        console.log('[qwe:debug] resolve token:', JSON.stringify(token));
        const controller = ctx.container.resolve<Record<string, Function>>(token);
        const method = controller[ctx.route!.handler.methodName];
        if (typeof method !== 'function') {
          throw new Error(`Method "${ctx.route!.handler.methodName}" not found on controller "${ctx.route!.handler.controllerToken}"`);
        }
        await method.call(controller, ctx);
      };

      const pipeline = [...interceptors, handler];

      const executePipeline = async (idx: number): Promise<void> => {
        if (idx >= pipeline.length) return;
        await pipeline[idx]!(ctx, async () => executePipeline(idx + 1));
      };

      await executePipeline(0);
    } catch (err) {
      console.error('[qwe] Handler error:', err);
      if (!qweRes.aborted()) {
        qweRes.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: 'Internal Server Error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  async listen(): Promise<void> {
    return new Promise((resolve) => {
      const host = this._config.host || '0.0.0.0';
      this._app.listen(host, this._config.port, (listenSocket) => {
        this._listenSocket = listenSocket;
        console.log(`\x1b[32m[qwe]\x1b[0m Server running at http${this._config.sslCertFile ? 's' : ''}://${host}:${this._config.port}`);
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (this._listenSocket) {
      uws.us_listen_socket_close(this._listenSocket);
      this._listenSocket = null;
    }
  }

  get app(): uws.TemplatedApp {
    return this._app;
  }
}
