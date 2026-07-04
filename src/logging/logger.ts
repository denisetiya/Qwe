import { LogLevel } from './levels.js';
import type { LogContext } from './context.js';
import type { LogFormatter } from './formatter.js';
import type { LogTransport } from './transport.js';
import { JsonFormatter } from './formatter.js';
import { ConsoleTransport } from './transport.js';

export interface LoggerOptions {
  level?: LogLevel;
  formatter?: LogFormatter;
  transport?: LogTransport;
  context?: LogContext;
}

export class Logger {
  private readonly level: LogLevel;
  private readonly formatter: LogFormatter;
  private readonly transport: LogTransport;
  private readonly context: LogContext;

  constructor(opts: LoggerOptions = {}) {
    this.level = opts.level ?? LogLevel.Info;
    this.formatter = opts.formatter ?? new JsonFormatter();
    this.transport = opts.transport ?? new ConsoleTransport();
    this.context = opts.context ?? {};
  }

  child(context: LogContext): Logger {
    return new Logger({
      level: this.level,
      formatter: this.formatter,
      transport: this.transport,
      context: { ...this.context, ...context },
    });
  }

  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.Trace, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.Debug, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.Info, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.Warn, message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.Error, message, context);
  }

  fatal(message: string, context?: LogContext): void {
    this.log(LogLevel.Fatal, message, context);
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (level < this.level) return;
    const merged = context ? { ...this.context, ...context } : this.context;
    const line = this.formatter.format(level, message, merged);
    this.transport.write(line);
  }

  close(): void {
    this.transport.close();
  }
}

export class LoggerBuilder {
  private level: LogLevel = LogLevel.Info;
  private formatter: LogFormatter = new JsonFormatter();
  private transport: LogTransport = new ConsoleTransport();
  private context: LogContext = {};

  setLevel(level: LogLevel): this {
    this.level = level;
    return this;
  }

  setFormatter(formatter: LogFormatter): this {
    this.formatter = formatter;
    return this;
  }

  setTransport(transport: LogTransport): this {
    this.transport = transport;
    return this;
  }

  setContext(context: LogContext): this {
    this.context = context;
    return this;
  }

  build(): Logger {
    return new Logger({
      level: this.level,
      formatter: this.formatter,
      transport: this.transport,
      context: this.context,
    });
  }
}
