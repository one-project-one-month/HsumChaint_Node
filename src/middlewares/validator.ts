import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type z from 'zod';
export const validator =
  (schema: z.ZodObject<any>) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      req.body = parsed.body; //transform value(e.g +959-> 09)
      return next();
    } catch (error: unknown) {
      console.log(error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: 'failed',
          message: 'Validation Error',
          detail: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(500).json({
        status: 'error',
        message: 'Internal Server Error',
        detail: null,
      });
    }
  };
