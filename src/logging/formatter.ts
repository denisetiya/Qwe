import { LogLevel, levelToName } from './levels.js';
import type { LogContext, LogEntry } from './context.js';

export interface LogFormatter {
  format(level: LogLevel, message: string, context?: LogContext): string;
}

export class JsonFormatter implements LogFormatter {
  format(level: LogLevel, message: string, context?: LogContext): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelToName(level),
      module: context?.module ?? 'app',
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    return JSON.stringify(entry);
  }
}

const COLORS: Record<string, string> = {
  Trace: '\x1b[90m',
  Debug: '\x1b[36m',
  Info: '\x1b[32m',
  Warn: '\x1b[33m',
  Error: '\x1b[31m',
  Fatal: '\x1b[35m',
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

export class PrettyFormatter implements LogFormatter {
  format(level: LogLevel, message: string, context?: LogContext): string {
    const levelName = levelToName(level);
    const color = COLORS[levelName] ?? RESET;
    const timestamp = new Date().toISOString();
    const moduleName = context?.module ?? 'app';

    const parts: string[] = [
      `${DIM}[${timestamp}]${RESET}`,
      `${color}${BOLD}${levelName.padEnd(5)}${RESET}`,
      `${DIM}[${moduleName}]${RESET}`,
      message,
    ];

    if (context) {
      const ctxKeys = Object.keys(context).filter((k) => k !== 'module');
      if (ctxKeys.length > 0) {
        const ctxObj: Record<string, unknown> = {};
        for (const k of ctxKeys) {
          ctxObj[k] = context[k];
        }
        parts.push(`${DIM}${JSON.stringify(ctxObj)}${RESET}`);
      }
    }

    return parts.join(' ');
  }
}

export type CustomFormatFn = (level: LogLevel, message: string, context?: LogContext) => string;

export class CustomFormatter implements LogFormatter {
  private formatter: CustomFormatFn;

  constructor(formatter: CustomFormatFn) {
    this.formatter = formatter;
  }

  format(level: LogLevel, message: string, context?: LogContext): string {
    return this.formatter(level, message, context);
  }
}
