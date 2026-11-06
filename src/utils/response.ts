import type { Response } from 'express';

export interface ApiResponse<T = unknown> {
  isSuccess: boolean;
  message: string;
  isFailure: boolean;
  data?: T;
  error?: unknown;
}

export const successResponse = <T>(res: Response, data: T, message: string, statusCode = 200) => {
  const response: ApiResponse<T> = {
    isSuccess: true,
    message,
    isFailure: false,
    data,
  };

  return res.status(statusCode).json(response);
};

export const errorResponse = (
  res: Response,
  error: unknown,
  message = 'Internal Server Error',
  statusCode = 500
) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const response: ApiResponse = {
    isSuccess: false,
    message,
    isFailure: true,
    error: isDevelopment ? error : undefined,
  };

  return res.status(statusCode).json(response);
};
