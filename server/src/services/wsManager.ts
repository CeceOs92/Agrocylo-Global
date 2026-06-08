import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import logger from "../config/logger.js";
import { config } from "../config/index.js";

interface AuthMessage {
  type: "auth";
  token: string;
}

interface ClientSocket {
  ws: WebSocket;
  wallet: string | null;
}

class WsManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientSocket> = new Map();

  /**
   * Attach a WebSocket server to the existing HTTP server.
   */
  init(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: config.wsPath,
    });

    this.wss.on("connection", (ws: WebSocket) => {
      const client: ClientSocket = { ws, wallet: null };
      this.clients.set(ws, client);
      logger.info(`WebSocket client connected (total: ${this.clients.size})`);

      ws.on("message", (raw: RawData) => {
        try {
          const msg = JSON.parse(raw.toString()) as AuthMessage;
          if (msg.type === "auth" && msg.token) {
            const payload = jwt.verify(msg.token, String(config.jwtSecret)) as { walletAddress: string };
            client.wallet = payload.walletAddress;
            logger.info(`WebSocket client authenticated: ${client.wallet}`);
          }
        } catch {
          logger.warn("WebSocket auth failed or received non-JSON message");
          ws.close(4001, "Unauthorized");
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        logger.info(
          `WebSocket client disconnected (total: ${this.clients.size})`,
        );
      });

      ws.on("error", (err: Error) => {
        logger.error("WebSocket client error", err);
        this.clients.delete(ws);
      });
    });

    logger.info(
      `WebSocket server listening on path ${config.wsPath}`,
    );
  }

  /**
   * Send a message to a single client, guarding against send failures.
   * A failed send drops the client so it can't wedge the broadcast loop.
   */
  private safeSend(ws: WebSocket, message: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(message);
    } catch (err) {
      logger.error("WebSocket send failed; dropping client", err);
      this.clients.delete(ws);
    }
  }

  /**
   * Broadcast an event to every connected client.
   */
  broadcast(event: string, payload: unknown): void {
    const message = JSON.stringify({
      event,
      payload,
      timestamp: new Date().toISOString(),
    });

    for (const { ws } of this.clients.values()) {
      this.safeSend(ws, message);
    }
  }

  /**
   * Broadcast an event only to clients authenticated with the given wallet address.
   */
  broadcastTo(wallet: string, event: string, payload: unknown): void {
    const message = JSON.stringify({
      event,
      payload,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients.values()) {
      if (client.wallet?.toLowerCase() === wallet.toLowerCase()) {
        this.safeSend(client.ws, message);
      }
    }
  }

  /**
   * Number of currently connected clients.
   */
  get clientCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WsManager();
