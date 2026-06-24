import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import logger from "../config/logger.js";

let wss: WebSocketServer | null = null;

export function attachWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    logger.info("WebSocket client connected");

    socket.on("close", () => {
      logger.info("WebSocket client disconnected");
    });

    socket.on("error", (err) => {
      logger.warn("WebSocket socket error", err);
    });
  });

  logger.info("WebSocket server attached at /ws");
  return wss;
}

export function broadcast(event: string, payload: unknown): void {
  if (!wss) return;
  const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function closeWebSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!wss) {
      resolve();
      return;
    }
    wss.close(() => {
      wss = null;
      logger.info("WebSocket server closed");
      resolve();
    });
  });
}

export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}
