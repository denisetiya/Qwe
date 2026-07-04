import { SCOPE_SINGLETON } from '../constants.js';

type Scope = typeof SCOPE_SINGLETON | 'transient' | 'request';

interface ProviderDef {
  token: string;
  factory: unknown;
  scope: Scope;
  instance?: unknown;
  paramNames?: string[];  // Cache parameter names for classes
}

function extractParamNames(fn: Function): string[] {
  const str = fn.toString();
  const match = str.match(/^(?:class\s+\S+\s*{)?(?:async\s+)?(?:function\s*\S*|\(\s*)?\(([^)]*)\)/);
  if (!match?.[1]) return [];
  return match[1]
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split('=')[0]!.trim())
    .filter(Boolean);
}

function isClass(fn: Function): boolean {
  return /^class[\s{]/.test(fn.toString());
}

export class Container {
  private providers = new Map<string, ProviderDef>();
  private requestScoped = new Map<string, Map<string, unknown>>();
  private reqCounter = 0;

  register(token: string, factory: unknown, scope: Scope = 'singleton'): this {
    const def: ProviderDef = { token, factory, scope };
    
    // Optimize: Cache parameter names for classes (avoid parsing on every resolve)
    if (typeof factory === 'function' && isClass(factory)) {
      def.paramNames = extractParamNames(factory);
    }
    
    this.providers.set(token, def);
    return this;
  }

  resolve<T = unknown>(token: string, requestId?: string): T {
    const def = this.providers.get(token);
    if (!def) {
      throw new Error(`[qwe] Provider "${token}" not registered`);
    }

    if (def.scope === 'singleton') {
      if (!def.instance) {
        def.instance = this.instantiate(def, undefined);
      }
      return def.instance as T;
    }

    if (def.scope === 'request') {
      if (!requestId) {
        throw new Error(`[qwe] "${token}" is request-scoped but no requestId provided`);
      }
      let store = this.requestScoped.get(token);
      if (!store) {
        store = new Map();
        this.requestScoped.set(token, store);
      }
      if (!store.has(requestId)) {
        store.set(requestId, this.instantiate(def, requestId));
      }
      return store.get(requestId) as T;
    }

    return this.instantiate(def, requestId) as T;
  }

  createRequestId(): string {
    return `req_${++this.reqCounter}_${Date.now()}`;
  }

  clearRequestScope(requestId: string): void {
    for (const [, store] of this.requestScoped) {
      store.delete(requestId);
    }
  }

  getSingletonInstances(): unknown[] {
    const instances: unknown[] = [];
    for (const [, def] of this.providers) {
      if (def.scope === 'singleton' && def.instance) {
        instances.push(def.instance);
      }
    }
    return instances;
  }

  async destroy(): Promise<void> {
    for (const [, def] of this.providers) {
      if (def.scope === 'singleton' && def.instance) {
        const fn = (def.instance as Record<string, unknown>).onDestroy;
        if (typeof fn === 'function') {
          await (fn as Function).call(def.instance);
        }
      }
    }
    this.providers.clear();
    this.requestScoped.clear();
  }

  private instantiate(def: ProviderDef, requestId: string | undefined): unknown {
    if (typeof def.factory === 'function') {
      // Optimize: Use cached paramNames instead of re-parsing
      if (def.paramNames !== undefined) {
        return this.instantiateClass(def.factory as new (...args: unknown[]) => unknown, def.paramNames, requestId);
      }
      // Fallback for non-class functions
      return (def.factory as Function)();
    }
    return def.factory;
  }

  private instantiateClass(
    Ctor: new (...args: unknown[]) => unknown,
    paramNames: string[],
    requestId: string | undefined
  ): unknown {
    if (paramNames.length === 0) {
      return new Ctor();
    }
    const args = new Array(paramNames.length);
    for (let i = 0; i < paramNames.length; i++) {
      args[i] = this.resolve(paramNames[i]!, requestId);
    }
    return new Ctor(...args);
  }
}
