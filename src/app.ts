import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import * as swStats from 'swagger-stats';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { globalErrorHandler } from './middlewares/errorHandler';
import { httpLogger } from './middlewares/httpLogger';
import authRoutes from './modules/auth/auth.routes';
import { userRouter } from './modules/user/user.routes';
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
//parses cookies
app.use(cookieParser());
// Logging
app.use(httpLogger);
// Routes
app.use('/api/v1/users', userRouter);
app.use('/api/v1/auth', authRoutes);
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
