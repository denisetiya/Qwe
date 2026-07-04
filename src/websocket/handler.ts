import { Connection } from './gateway';

export interface IncomingMessage {
  type: string;
  payload?: unknown;
  room?: string;
}

export type HandlerFn = (conn: Connection, payload: unknown) => Promise<void> | void;

export class MessageHandler {
  private handlers = new Map<string, HandlerFn[]>();
  private fallbackHandlers: HandlerFn[] = [];

  on(type: string, fn: HandlerFn): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(fn);
    this.handlers.set(type, existing);
  }

  onFallback(fn: HandlerFn): void {
    this.fallbackHandlers.push(fn);
  }

  off(type: string): void {
    this.handlers.delete(type);
  }

  async route(conn: Connection, raw: string): Promise<void> {
    let message: IncomingMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    const fns = this.handlers.get(message.type);
    if (fns && fns.length > 0) {
      for (const fn of fns) await fn(conn, message.payload);
    } else {
      for (const fn of this.fallbackHandlers) await fn(conn, message);
    }
  }

  getTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
