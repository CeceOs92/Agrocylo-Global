import http from 'http';
import app from './app.js';
import logger from './config/logger.js';
import { config } from './config/index.js';
import { connectDB } from './db/client.js';
import { startSorobanEventListener } from './services/sorobanEventListener.js';
import { startProductionWatcher } from './events/watcher.js';
import { attachWebSocketServer } from './services/wsServer.js';
import { registerHttpServer, registerWatcher, shutdown } from './services/lifecycle.js';

async function bootstrap() {
  try {
    await connectDB();

    let sorobanInterval: ReturnType<typeof setInterval> | null = null;
    if (config.escrowContractId || config.productionEscrowContractId) {
      sorobanInterval = await startSorobanEventListener();
      if (sorobanInterval) {
        registerWatcher(sorobanInterval);
      }
    }

    let watcherInterval: ReturnType<typeof setInterval> | null = null;
    if (config.contractId && config.contractId !== 'C...') {
      watcherInterval = await startProductionWatcher();
      if (watcherInterval) {
        registerWatcher(watcherInterval);
      }
    } else {
      logger.warn('PRODUCTION_CONTRACT_ID not set — single-contract watcher disabled');
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
  shutdown('SIGTERM').then(() => process.exit(0));
});

process.on('SIGINT', () => {
  shutdown('SIGINT').then(() => process.exit(0));
});

bootstrap();
