import http from 'http';
import app from './app.js';
import logger from './config/logger.js';
import { config } from './config/index.js';
import { connectDB } from './db/client.js';
import { startProductionWatcher } from './events/watcher.js';
import { runProductionReconciliation } from './services/reconciliationService.js';
import { attachWebSocketServer } from './services/wsServer.js';
import { registerHttpServer, registerWatcher, shutdown } from './services/lifecycle.js';

async function bootstrap() {
  try {
    await connectDB();

    let watcherInterval: ReturnType<typeof setInterval> | null = null;
    watcherInterval = await startProductionWatcher();
    if (watcherInterval) {
      registerWatcher(watcherInterval);
    }

    // Start reconciliation scheduler (every 15 minutes)
    const RECONCILIATION_INTERVAL_MS = 15 * 60 * 1000;
    const reconciliationInterval = setInterval(() => {
      runProductionReconciliation().catch((err) => {
        logger.error('[Reconciliation] Scheduled run failed', { error: err instanceof Error ? err.message : String(err) });
      });
    }, RECONCILIATION_INTERVAL_MS);
    registerWatcher(reconciliationInterval);
    logger.info('[Reconciliation] Scheduled to run every 15 minutes');

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
  shutdown('SIGTERM').then(() => process.exit(0));
});

process.on('SIGINT', () => {
  shutdown('SIGINT').then(() => process.exit(0));
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? reason.stack : undefined });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception — shutting down', { error: error.message, stack: error.stack });
  process.exit(1);
});

bootstrap();
