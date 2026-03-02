import { NextFunction, Request, Response } from 'express';
import { errorResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { ZodError } from 'zod';

export const globalErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorData: any = process.env.NODE_ENV === 'development' ? err : undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    errorData = (err as any).errors || (err as any).issues;
  } else if (err instanceof Error && err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  }

  // Handle other well known errors (e.g. Prisma etc.)
  // if (err instanceof PrismaClientKnownRequestError) { ... }

  errorResponse(res, errorData, message, statusCode);
};
