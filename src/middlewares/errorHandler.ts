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
  } else if (isDatabaseConnectionError(err)) {
    statusCode = 503;
    message = 'Database unavailable. Please check the database is running and reachable.';
    errorData = process.env.NODE_ENV === 'development' ? err : undefined;
  }

  errorResponse(res, errorData, message, statusCode);
};

function isDatabaseConnectionError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as { name?: string; cause?: { message?: string; originalCode?: string } };
    if (e.name === 'DriverAdapterError') return true;
    const msg = (e.cause?.message ?? (e as Error).message ?? '').toString();
    return (
      msg.includes('pool timeout') ||
      msg.includes('Connection timeout') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ENOTFOUND') ||
      e.cause?.originalCode === '45028'
    );
  }
  return false;
}
