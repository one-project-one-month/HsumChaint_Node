import express, { ErrorRequestHandler } from 'express';
import * as swStats from 'swagger-stats';
import swaggerUi from 'swagger-ui-express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { userRouter } from './modules/user/user.routes';
import { swaggerSpec } from './config/swagger';
import { globalErrorHandler } from './middlewares/errorHandler';
import { httpLogger } from './middlewares/httpLogger';
import { errorResponse, successResponse } from './utils/response';

const app = express();

// Telescope-like HTML Dashboard (Available at /stats)
app.use(swStats.getMiddleware({ uriPath: '/stats' }));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Security
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Body parsing (Must be above logging to see req.body)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(httpLogger);

// Routes
app.use('/api/v1/users', userRouter);

// Health check
app.get('/health', (_, res) => {
  return successResponse(res, { status: 'ok', timestamp: new Date() }, 'Health check');
});

app.use((_req, res) => {
  return errorResponse(res, null, 'Not Found', 404);
});

// Global Error Handler
app.use(globalErrorHandler as ErrorRequestHandler);

export { app };
