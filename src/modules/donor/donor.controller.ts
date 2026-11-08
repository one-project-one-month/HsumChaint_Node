import type { NextFunction, Request, Response } from 'express';
import type { PaginationQueryType } from '../../helper/paginationSchema';
import {
  type PaginationMeta,
  sendErrorResponse,
  sendPaginatedResponse,
  sendSuccessResponse,
} from '../../utils/response';
import type { CreateDonorType, GetAllDonorsQueryType, UpdateDonorType } from './donor.schema';
import {
  createDonorService,
  deleteDonorService,
  getAllDonorsService,
  getDonorByIdService,
  updateDonorService,
} from './donor.service';

type DonorIdParam = { id: string };

const createDonor = async (
  req: Request<unknown, unknown, CreateDonorType['body']>,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.body == null || typeof req.body !== 'object') {
      return next(new Error('Request body is required'));
    }
    const donor = await createDonorService({ body: req.body });
    return sendSuccessResponse(res, donor, 'Donor created successfully.', 200);
  } catch (error) {
    next(error);
  }
};

const getAllDonors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      email,
      phoneNo,
      page = '1',
      limit = '10',
    } = req.query as Partial<GetAllDonorsQueryType['query'] & PaginationQueryType>;
    const pageNumber = Number(page) || 1;
    const pageSize = Number(limit) || 10;
    const result = await getAllDonorsService(
      req,
      { name, email, phoneNo },
      { page: pageNumber, limit: pageSize }
    );
    const totalCount = result.pagination.meta.total;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const paginationMeta: PaginationMeta = {
      pageNumber,
      pageSize,
      totalCount,
      totalPages,
      hasPreviousPage: pageNumber > 1,
      hasNextPage: pageNumber < totalPages,
    };
    return sendPaginatedResponse(
      res,
      result.donors,
      paginationMeta,
      'Donors retrieved successfully.',
      200
    );
  } catch (error) {
    next(error);
  }
};

const getDonorById = async (req: Request<DonorIdParam>, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return sendErrorResponse(res, null, 'Invalid donor ID. ID must be a number.', 400);
    }

    const donor = await getDonorByIdService(id);
    return sendSuccessResponse(res, donor, 'Donor retrieved successfully.', 200);
  } catch (error) {
    next(error);
  }
};

const updateDonor = async (
  req: Request<DonorIdParam, unknown, UpdateDonorType['body']>,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const donor = await updateDonorService(id, { body: req.body });
    return sendSuccessResponse(res, donor, 'Donor updated successfully.', 200);
  } catch (error) {
    next(error);
  }
};

const deleteDonor = async (req: Request<DonorIdParam>, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    await deleteDonorService(id);
    return sendSuccessResponse(res, undefined, 'Donor deleted successfully.', 200);
  } catch (error) {
    next(error);
  }
};

export { createDonor, deleteDonor, getAllDonors, getDonorById, updateDonor };
