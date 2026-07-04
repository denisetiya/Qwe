export const VERSION = '1.0.0';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

export const SCOPE_SINGLETON = 'singleton' as const;
export const SCOPE_TRANSIENT = 'transient' as const;
export const SCOPE_REQUEST = 'request' as const;

export const LIFECYCLE_HOOKS = ['onInit', 'onDestroy', 'onModuleInit', 'onModuleDestroy'] as const;

export const DEFAULT_BODY_LIMIT = 10 * 1024 * 1024;
export const DEFAULT_FILE_LIMIT = 50 * 1024 * 1024;
export const DEFAULT_COMPRESSION_THRESHOLD = 1024;
export const DEFAULT_RATE_LIMIT_WINDOW = 60000;
export const DEFAULT_RATE_LIMIT_MAX = 100;
export const DEFAULT_POOL_MIN = 2;
export const DEFAULT_POOL_MAX = 10;
export const DEFAULT_IDLE_TIMEOUT = 30000;
export const DEFAULT_CONNECTION_TIMEOUT = 120000;