import logger from "./config/logger.js";
import { initializeSentry } from "./config/observability.js";
import { startWorkers } from "./queues/workers.js";

// Initialize error tracking and tracing
initializeSentry('worker');

const running = startWorkers();

function shutdown(signal: string) {
  logger.warn(`Worker shutdown signal received: ${signal}`);
  running
    .close()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("Worker shutdown failure", err);
      process.exit(1);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

