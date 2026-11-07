import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { errorResponse } from '../utils/response';

interface PrismaErrorLike {
  code?: string;
  name?: string;
  meta?: {
    modelName?: string;
    target?: string | string[];
    driverAdapterError?: {
      cause?: {
        constraint?: { index?: string };
        originalMessage?: string;
        originalCode?: string;
      };
    };
  };
}

function isPrismaUniqueConstraintError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const pErr = err as PrismaErrorLike;
    return pErr.code === 'P2002';
  }
  return false;
}

function getPrismaUniqueConstraintMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const pErr = err as PrismaErrorLike;
    const model = pErr.meta?.modelName;
    const constraint =
      pErr.meta?.driverAdapterError?.cause?.constraint?.index ||
      (Array.isArray(pErr.meta?.target) ? pErr.meta?.target.join(',') : pErr.meta?.target) ||
      '';
    const origMsg = pErr.meta?.driverAdapterError?.cause?.originalMessage || '';

    if (
      model === 'SpaceRole' ||
      constraint.includes('space_role') ||
      origMsg.includes('Space_Role')
    ) {
      return 'Space role name already exists';
    }
    if (model === 'Role' || constraint.includes('role_name') || origMsg.includes('Role.')) {
      return 'Role name already exists';
    }
    if (model === 'User' || constraint.includes('phone') || origMsg.includes('phone')) {
      return 'Phone number already registered';
    }
    if (constraint.includes('email') || origMsg.includes('email')) {
      return 'Email address already registered';
    }
  }
  return 'A record with this unique value already exists';
}

export const globalErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorData: unknown = process.env.NODE_ENV === 'development' ? err : undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    errorData = err.issues;
  } else if (err instanceof Error && err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  } else if (isPrismaUniqueConstraintError(err)) {
    statusCode = 400;
    message = getPrismaUniqueConstraintMessage(err);
    errorData = process.env.NODE_ENV === 'development' ? err : undefined;
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
