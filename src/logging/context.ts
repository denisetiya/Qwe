export interface LogContext {
  requestId?: string;
  userId?: string;
  module?: string;
  traceId?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  context?: LogContext;
}
