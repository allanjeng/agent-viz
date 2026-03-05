import { WebSocket, WebSocketServer } from "ws";

import { BridgeStateStore } from "./state-store.js";
import { BridgeStateMessage, DashboardSnapshot } from "./types.js";

export class BridgeWsServer {
  private wss: WebSocketServer | null = null;

  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly store: BridgeStateStore,
    private readonly port: number,
  ) {}

  start(): void {
    if (this.wss) {
      return;
    }

    this.wss = new WebSocketServer({ port: this.port });
    this.wss.on("connection", (socket) => this.onConnection(socket));

    this.unsubscribe = this.store.subscribe((snapshot) => {
      this.broadcast(snapshot);
    });

    console.log(`[bridge] WebSocket server listening on ws://localhost:${this.port}`);
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  private onConnection(socket: WebSocket): void {
    const message: BridgeStateMessage = {
      type: "state",
      data: this.store.snapshot(),
    };

    socket.send(JSON.stringify(message));
  }

  private broadcast(snapshot: DashboardSnapshot): void {
    if (!this.wss) {
      return;
    }

    const message: BridgeStateMessage = {
      type: "state",
      data: snapshot,
    };

    const encoded = JSON.stringify(message);

    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(encoded);
      }
    }
  }
}
