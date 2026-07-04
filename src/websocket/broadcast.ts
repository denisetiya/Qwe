import { Gateway, type Connection } from './gateway.js';

export class Broadcaster<UserData extends Record<string, unknown> = Record<string, unknown>> {
  constructor(private gateway: Gateway<UserData>) {}

  toConnection(connId: string, type: string, payload?: unknown): void {
    const conn = this.gateway.getConnection(connId);
    if (conn) this.send(conn, { type, payload });
  }

  toRoom(room: string, type: string, payload?: unknown): void {
    const data = JSON.stringify({ type, payload });
    this.gateway.getRoomMembers(room).forEach(c => {
      this.sendRaw(c, data);
    });
  }

  toAll(type: string, payload?: unknown): void {
    const data = JSON.stringify({ type, payload });
    this.gateway.getAllConnections().forEach(c => {
      this.sendRaw(c, data);
    });
  }

  toAllExcept(excludeId: string, type: string, payload?: unknown): void {
    const data = JSON.stringify({ type, payload });
    this.gateway.getAllConnections().forEach(c => {
      if (c.id !== excludeId) {
        this.sendRaw(c, data);
      }
    });
  }

  private send(conn: Connection<UserData>, message: Record<string, unknown>): void {
    try {
      conn.socket.send(JSON.stringify(message));
    } catch {
      // Connection might be closed
    }
  }

  private sendRaw(conn: Connection<UserData>, data: string): void {
    try {
      conn.socket.send(data);
    } catch {
      // Connection might be closed
    }
  }
}
