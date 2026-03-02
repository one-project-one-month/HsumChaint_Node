import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

const SILENT_PATHS = ['/health', '/stats', '/api-docs', '/favicon.ico'];

export const httpLogger = pinoHttp({
  logger,
  // Skip noisy internal/health check routes
  autoLogging: {
    ignore: (req) => SILENT_PATHS.some((p) => req.url?.startsWith(p)),
  },
  // Clean one-liner log messages
  customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} → ${res.statusCode} | ${err.message}`,
  // Only include body/query when they are non-empty
  customProps: (req: any) => ({
    ...(req.body && Object.keys(req.body).length ? { body: req.body } : {}),
    ...(Object.keys(req.query ?? {}).length ? { query: req.query } : {}),
  }),
  serializers: {
    req: () => undefined as any, // Suppress default req object
    res: () => undefined as any, // Suppress default res object
  },
});
