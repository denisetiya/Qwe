import type { TemplatedApp, WebSocket as UwsWebSocket } from 'uWebSockets.js';

export interface Connection<UserData = Record<string, unknown>> {
  id: string;
  socket: UwsWebSocket<UserData>;
  rooms: Set<string>;
  meta: Record<string, unknown>;
}

export type ConnectionListener<UserData = Record<string, unknown>> = (conn: Connection<UserData>) => void;

export interface GatewayOptions<_UserData = Record<string, unknown>> {
  path?: string;
  maxPayloadLength?: number;
  idleTimeout?: number;
}

export class Gateway<UserData extends Record<string, unknown> = Record<string, unknown>> {
  private connections = new Map<string, Connection<UserData>>();
  private onConnectionListeners: ConnectionListener<UserData>[] = [];
  private onDisconnectListeners: ConnectionListener<UserData>[] = [];
  private idCounter = 0;

  constructor(_app: TemplatedApp, options: GatewayOptions<UserData> = {}) {
    // uWS handles WebSocket upgrade internally via app.ws()
    // Gateway is initialized with options for future extension
    if (options.maxPayloadLength !== undefined || options.idleTimeout !== undefined) {
      // Options stored for configuration
    }
  }

  onConnect(fn: ConnectionListener<UserData>): void {
    this.onConnectionListeners.push(fn);
  }

  onDisconnect(fn: ConnectionListener<UserData>): void {
    this.onDisconnectListeners.push(fn);
  }

  private fireOnConnect(conn: Connection<UserData>): void {
    this.onConnectionListeners.forEach(fn => fn(conn));
  }

  private fireOnDisconnect(conn: Connection<UserData>): void {
    this.onDisconnectListeners.forEach(fn => fn(conn));
  }

  getConnection(id: string): Connection<UserData> | undefined {
    return this.connections.get(id);
  }

  getAllConnections(): Connection<UserData>[] {
    return Array.from(this.connections.values());
  }

  joinRoom(connId: string, room: string): void {
    const conn = this.connections.get(connId);
    if (conn) conn.rooms.add(room);
  }

  leaveRoom(connId: string, room: string): void {
    const conn = this.connections.get(connId);
    if (conn) conn.rooms.delete(room);
  }

  getRoomMembers(room: string): Connection<UserData>[] {
    return this.getAllConnections().filter(c => c.rooms.has(room));
  }

  // Called by uWS open handler
  registerConnection(socket: UwsWebSocket<UserData & { connId: string }>): Connection<UserData> {
    const userData = socket.getUserData();
    const connId = userData.connId;
    const conn: Connection<UserData> = {
      id: connId,
      socket,
      rooms: new Set(),
      meta: {},
    };
    this.connections.set(connId, conn);
    this.fireOnConnect(conn);
    return conn;
  }

  // Called by uWS close handler
  unregisterConnection(connId: string): void {
    const conn = this.connections.get(connId);
    if (conn) {
      this.connections.delete(conn.id);
      conn.rooms.forEach(room => this.leaveRoom(conn.id, room));
      this.fireOnDisconnect(conn);
    }
  }

  nextId(): string {
    return `conn_${++this.idCounter}_${Date.now()}`;
  }

  close(): void {
    this.connections.forEach(c => c.socket.end());
    this.connections.clear();
  }
}
