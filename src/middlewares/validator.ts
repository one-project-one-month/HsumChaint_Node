import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import type z from "zod";

export const validator =
  (schema: z.ZodTypeAny) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      return next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        // custom error handling
        return res.status(400).json({
          status: "failed",
          message: "Validation Error",
          detail: error.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
      }

      return res.status(500).json({
        status: "error",
        message: "Internal Server Error",
        detail: null,
      });
    }
  };