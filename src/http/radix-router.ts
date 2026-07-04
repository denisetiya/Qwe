export interface RouteHandler {
  controllerToken: string;
  methodName: string;
}

export interface RouteDefinition {
  method: string;
  path: string;
  handler: RouteHandler;
  guards?: Function[];
  interceptors?: Function[];
  filters?: Function[];
  meta?: Record<string, unknown>;
}

export interface RouteMatch {
  handler: RouteHandler;
  params: Record<string, string>;
  meta?: Record<string, unknown>;
}

interface RouteNode {
  children: Map<string, RouteNode>;
  paramChild?: RouteNode;
  paramName?: string;
  handlers: Map<string, { handler: RouteHandler; meta?: Record<string, unknown> }>;
}

function createNode(): RouteNode {
  return {
    children: new Map(),
    handlers: new Map(),
  };
}

export class RadixRouter {
  private root: RouteNode = createNode();
  private _size = 0;
  // Route cache for frequently accessed paths (max 100 entries)
  private readonly CACHE_SIZE = 100;
  private cache = new Map<string, RouteMatch | null>();

  add(method: string, path: string, handler: RouteHandler, meta?: Record<string, unknown>): void {
    const parts = path.split('/').filter(Boolean);
    let node = this.root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (part.startsWith(':')) {
        if (!node.paramChild) {
          node.paramChild = createNode();
          node.paramName = part.slice(1);
        }
        node = node.paramChild;
      } else {
        let child = node.children.get(part);
        if (!child) {
          child = createNode();
          node.children.set(part, child);
        }
        node = child;
      }
    }

    const m = method.toUpperCase();
    if (m === 'ANY') {
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
        node.handlers.set(method, { handler, meta });
      }
    } else {
      node.handlers.set(m, { handler, meta });
    }
    this._size++;
  }

  find(method: string, path: string): RouteMatch | null {
    // Check cache first (O(1) for cached routes)
    const cacheKey = `${method}:${path}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    const parts = path.split('/').filter(Boolean);
    const params: Record<string, string> = {};

    const node = this._walk(this.root, parts, 0, params);
    if (!node) {
      this._addToCache(cacheKey, null);
      return null;
    }

    const match = node.handlers.get(method.toUpperCase());
    if (!match) {
      this._addToCache(cacheKey, null);
      return null;
    }

    const result: RouteMatch = { handler: match.handler, params, meta: match.meta };
    this._addToCache(cacheKey, result);
    return result;
  }

  private _addToCache(key: string, value: RouteMatch | null): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  private _walk(
    node: RouteNode,
    parts: string[],
    idx: number,
    params: Record<string, string>,
  ): RouteNode | null {
    if (idx === parts.length) {
      return node.handlers.size > 0 ? node : null;
    }

    const part = parts[idx]!;

    const literalChild = node.children.get(part);
    if (literalChild) {
      const result = this._walk(literalChild, parts, idx + 1, params);
      if (result) return result;
    }

    if (node.paramChild && node.paramName) {
      params[node.paramName] = part;
      const result = this._walk(node.paramChild, parts, idx + 1, params);
      if (result) return result;
      delete params[node.paramName];
    }

    return null;
  }

  size(): number {
    return this._size;
  }

  getAllRoutes(): RouteDefinition[] {
    const routes: RouteDefinition[] = [];
    const walk = (node: RouteNode, pathParts: string[]): void => {
      for (const [method, match] of node.handlers) {
        routes.push({
          method,
          path: '/' + pathParts.join('/'),
          handler: match.handler,
          meta: match.meta,
        });
      }
      for (const [key, child] of node.children) {
        walk(child, [...pathParts, key]);
      }
      if (node.paramChild) {
        walk(node.paramChild, [...pathParts, `:${node.paramName}`]);
      }
    };
    walk(this.root, []);
    return routes;
  }
}
