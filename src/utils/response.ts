import type { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
}

export const successResponse = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200
) => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  return res.status(statusCode).json(response);
};

export const errorResponse = (
  res: Response,
  error: any,
  message = 'Internal Server Error',
  statusCode = 500
) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const response: ApiResponse = {
    success: false,
    message,
    // Add detailed error only outside of production
    error: isDevelopment ? error : undefined,
  };

  return res.status(statusCode).json(response);
};
