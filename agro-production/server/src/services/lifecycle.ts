import http from 'http';
import logger from '../config/logger.js';
import { disconnectDB } from '../db/client.js';
import { closeWebSocketServer } from './wsServer.js';
import { config } from '../config/index.js';

type WatcherHandle = { stop: () => void } | ReturnType<typeof setInterval>;

const watchers: WatcherHandle[] = [];

export function registerWatcher(handle: WatcherHandle): void {
  watchers.push(handle);
}

export function getWatchers(): WatcherHandle[] {
  return watchers;
}

function stopAllWatchers(): void {
  for (const handle of watchers) {
    if (typeof handle === 'object' && 'stop' in handle && typeof (handle as { stop: () => void }).stop === 'function') {
      (handle as { stop: () => void }).stop();
    } else {
      clearInterval(handle as ReturnType<typeof setInterval>);
    }
  }
  watchers.length = 0;
  logger.info('All watchers stopped');
}

let server: http.Server | null = null;
let isShuttingDown = false;

export function registerHttpServer(s: http.Server): void {
  server = s;
}

export function isGracefullyShuttingDown(): boolean {
  return isShuttingDown;
}

export async function shutdown(signal?: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal ?? 'shutdown command'} — starting graceful shutdown`);

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  await Promise.race([
    closeWebSocketServer(),
    new Promise((resolve) => setTimeout(resolve, config.shutdownTimeoutMs)),
  ]);

  stopAllWatchers();

  await disconnectDB();

  logger.info('Graceful shutdown complete');
}
