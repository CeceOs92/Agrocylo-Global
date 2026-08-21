import http from 'http';
import { initSentry, Sentry } from './config/sentry.js';
import app from './app.js';
import logger from './config/logger.js';
import { config } from './config/index.js';
import { connectDB } from './db/client.js';
import { startProductionWatcher } from './events/watcher.js';
import { attachWebSocketServer } from './services/wsServer.js';
import { registerHttpServer, registerWatcher, shutdown } from './services/lifecycle.js';
import { startReconciliationSweep, stopReconciliationSweep } from './services/reconciliationSweep.js';

async function bootstrap() {
  try {
    initSentry();
    await connectDB();

    let watcherInterval: ReturnType<typeof setInterval> | null = null;
    watcherInterval = await startProductionWatcher();
    if (watcherInterval) {
      registerWatcher(watcherInterval);
    }

    if (config.runReconciliationSweep) {
      startReconciliationSweep(config.reconciliationSweepIntervalMs);
      logger.info(
        `[bootstrap]: Reconciliation drift sweep started (interval: ${config.reconciliationSweepIntervalMs}ms)`,
      );
    }

    const server = http.createServer(app);
    registerHttpServer(server);
    attachWebSocketServer(server);

    server.listen(config.port, () => {
      logger.info(
        `[server]: Production backend running at http://localhost:${config.port}`,
      );
    });
  } catch (error) {
    logger.error('Critical failure during startup:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  stopReconciliationSweep();
  shutdown('SIGTERM').then(() => process.exit(0));
});

process.on('SIGINT', () => {
  stopReconciliationSweep();
  shutdown('SIGINT').then(() => process.exit(0));
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? reason.stack : undefined });
  Sentry.captureException(reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception — shutting down', { error: error.message, stack: error.stack });
  Sentry.captureException(error);
  Sentry.close(2000).finally(() => process.exit(1));
});

bootstrap();
