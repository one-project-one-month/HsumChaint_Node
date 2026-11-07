import type { Response } from 'express';

export interface PaginationMetadata {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface CursorPaginationMetadata {
  nextCursor: number | null;
  hasNextPage: boolean;
  pageSize: number;
}

export interface ApiResponse<T = unknown> {
  isSuccess: boolean;
  message: string;
  isFailure: boolean;
  data?: T;
  pagination?: PaginationMetadata | CursorPaginationMetadata;
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

export const voidSuccessResponse = (res: Response, message: string, statusCode = 200) => {
  const response: ApiResponse = {
    isSuccess: true,
    message,
    isFailure: false,
  };

  return res.status(statusCode).json(response);
};

export const pagedSuccessResponse = <T>(
  res: Response,
  data: T,
  pagination: PaginationMetadata,
  message = 'Success',
  statusCode = 200
) => {
  const response: ApiResponse<T> = {
    isSuccess: true,
    message,
    isFailure: false,
    data,
    pagination,
  };

  return res.status(statusCode).json(response);
};

export const cursorSuccessResponse = <T>(
  res: Response,
  data: T,
  pagination: CursorPaginationMetadata,
  message = 'Success',
  statusCode = 200
) => {
  const response: ApiResponse<T> = {
    isSuccess: true,
    message,
    isFailure: false,
    data,
    pagination,
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
