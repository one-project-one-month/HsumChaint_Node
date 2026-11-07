import type { Response } from 'express';

export interface PaginationEnvelope {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  isSuccess: boolean;
  isFailure: boolean;
  message: string;
  data?: T;
  pagination?: PaginationEnvelope;
  error?: unknown;
}

export const successResponse = <T>(
  res: Response,
  data: T,
  message = 'Operation completed successfully.',
  statusCode = 200,
  pagination?: PaginationEnvelope
) => {
  const response: ApiResponse<T> = {
    success: true,
    isSuccess: true,
    isFailure: false,
    message,
    data,
    ...(pagination ? { pagination } : {}),
  };
  return res.status(statusCode).json(response);
};

export const pagedSuccessResponse = <T>(
  res: Response,
  data: T,
  pagination: {
    pageNumber: number;
    pageSize: number;
    totalCount: number;
  },
  message = 'Operation completed successfully.',
  statusCode = 200
) => {
  const totalPages = Math.ceil(pagination.totalCount / pagination.pageSize) || 1;
  const paginationEnvelope: PaginationEnvelope = {
    pageNumber: pagination.pageNumber,
    pageSize: pagination.pageSize,
    totalCount: pagination.totalCount,
    totalPages,
    hasPreviousPage: pagination.pageNumber > 1,
    hasNextPage: pagination.pageNumber < totalPages,
  };

  return successResponse(res, data, message, statusCode, paginationEnvelope);
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
    isSuccess: false,
    isFailure: true,
    message,
    // Add detailed error only outside of production
    error: isDevelopment ? error : undefined,
  };

  return res.status(statusCode).json(response);
};
