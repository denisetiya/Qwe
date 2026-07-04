export type LifecycleHook = 'onInit' | 'onDestroy';

export interface WithLifecycle {
  onInit?(): void | Promise<void>;
  onDestroy?(): void | Promise<void>;
}

export async function callHook(instance: unknown, hook: LifecycleHook): Promise<void> {
  const fn = (instance as Record<string, unknown>)[hook];
  if (typeof fn === 'function') {
    await (fn as Function).call(instance);
  }
}
