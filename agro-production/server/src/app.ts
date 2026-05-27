import express, { type Request, type Response } from 'express';
import cors from 'cors';
import logger from './config/logger.js';
import { config } from './config/index.js';
import { defaultLimiter } from './middleware/rateLimit.js';
import { jsonValidated } from './middleware/validate.js';
import campaignImageRoutes, {
  campaignImageErrorHandler,
} from './routes/campaignImageRoutes.js';
import campaignRoutes from './routes/campaigns.js';
import orderRoutes from './routes/orders.js';
import { globalErrorHandler } from './middleware/errors.js';
import { HealthResponseSchema } from './schemas/health.js';
import { serveOpenApiDocument } from './openapi/document.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(defaultLimiter);

// Campaign image upload/delete (Issue #155)
app.use(campaignImageRoutes);

// Campaign and order REST endpoints
app.use('/api/v1', campaignRoutes);
app.use('/api/v1', orderRoutes);

app.get('/health', (_req: Request, res: Response) => {
  logger.info('Health check endpoint hit');
  jsonValidated(res, HealthResponseSchema, 200, {
    status: 'UP',
    service: 'agro-production-server',
    env: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/docs/openapi.json', serveOpenApiDocument);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(campaignImageErrorHandler);

app.use(globalErrorHandler);

export default app;
