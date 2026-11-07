import type { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: unknown;
}

export interface PaginationMeta {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface GenericResponse<T = unknown> {
  isSuccess: boolean;
  message: string;
  isFailure: boolean;
  data?: T;
  pagination?: PaginationMeta;
  error?: unknown;
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
  error: unknown,
  message = 'Internal Server Error',
  statusCode = 500
) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const response: ApiResponse = {
    success: false,
    message,
    error: isDevelopment ? error : undefined,
  };

  return res.status(statusCode).json(response);
};

export const sendSuccessResponse = <T>(
  res: Response,
  data: T,
  message = 'Operation completed successfully.',
  statusCode = 200
) => {
  const response: GenericResponse<T> = {
    isSuccess: true,
    message,
    isFailure: false,
    data,
  };
  return res.status(statusCode).json(response);
};

export const sendPaginatedResponse = <T>(
  res: Response,
  data: T,
  pagination: PaginationMeta,
  message = 'Operation completed successfully.',
  statusCode = 200
) => {
  const response: GenericResponse<T> = {
    isSuccess: true,
    message,
    isFailure: false,
    data,
    pagination,
  };
  return res.status(statusCode).json(response);
};

export const sendErrorResponse = (
  res: Response,
  error: unknown = null,
  message = 'An error occurred.',
  statusCode = 500
) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const response: GenericResponse = {
    isSuccess: false,
    message,
    isFailure: true,
    error: isDevelopment ? error : null,
  };

  return res.status(statusCode).json(response);
};
