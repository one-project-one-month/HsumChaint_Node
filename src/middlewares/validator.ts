import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import type z from "zod";

export const validator =
  (schema: z.ZodTypeAny) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      })) as { body?: unknown; params?: Record<string, string>; query?: Record<string, unknown> };
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.params != null && typeof parsed.params === "object") req.params = parsed.params;
      if (parsed.query != null && typeof parsed.query === "object") req.query = parsed.query as Request["query"];
      return next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const isMissingBody = error.issues.some(
          (e) =>
            e.path[0] === "body" &&
            (e.code === "invalid_type" ||
              e.message.toLowerCase().includes("required"))
        );
        if (isMissingBody) {
          return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: "Request body is required",
          });
        }
        return res.status(400).json({
          success: false,
          message: "Validation Error",
          error: error.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: null,
      });
    }
  };