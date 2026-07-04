import type { RouteDefinition } from './router.js';

export interface ModuleDefinition {
  name: string;
  controllers: Map<string, Function>;
  providers: Map<string, { factory: unknown; scope?: string }>;
  routes: RouteDefinition[];
  globalGuards: Function[];
  globalInterceptors: Function[];
  globalFilters: Function[];
  imports: ModuleDefinition[];
}

export const Metadata = {
  modules: new Map<string, ModuleDefinition>(),

  register(name: string, def: ModuleDefinition): void {
    this.modules.set(name, def);
  },

  get(name: string): ModuleDefinition | undefined {
    return this.modules.get(name);
  },

  getAll(): ModuleDefinition[] {
    return [...this.modules.values()];
  },

  clear(): void {
    this.modules.clear();
  },
};
