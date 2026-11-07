import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';

export const validator =
  <T extends ZodTypeAny>(schema: T) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Combine all request data into one object for validation
      const parsed = await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
        cookies: req.cookies ?? {},
      });

      // 2. Safely cast the parsed result
      const data = parsed as {
        body?: unknown;
        params?: Request['params'];
        query?: Request['query'];
        cookies?: Request['cookies'];
      };

      // 3. Simple, clean reassignment (Standard Express pattern)
      if (data.body !== undefined) Object.assign(req.body, data.body);
      if (data.params !== undefined) Object.assign(req.params, data.params);
      if (data.query !== undefined) Object.assign(req.query, data.query);
      if (data.cookies !== undefined) Object.assign(req.cookies, data.cookies);

      return next();
    } catch (error: unknown) {
      // Handle Zod Validation Errors
      if (error instanceof ZodError) {
        const primaryMessage = error.issues[0]?.message || 'Validation Error';
        return res.status(400).json({
          isSuccess: false,
          message: primaryMessage,
          isFailure: true,
          error: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      // Handle unexpected server errors and log them for debugging
      console.error('[Validator Error]:', error);

      return res.status(500).json({
        isSuccess: false,
        message: 'Internal Server Error',
        isFailure: true,
        error: null,
      });
    }
  };
